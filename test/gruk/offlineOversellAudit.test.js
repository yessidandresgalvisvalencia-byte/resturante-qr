"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {recordOfflineOversellConflict:record}=require("../../core/offline/offlineOversellAudit.service");
const eventId="01ARZ3NDEKTSV4RRFFQ69G5FA0";
const productId="507f1f77bcf86cd799439011";
const context={empresaId:"507f191e810c19729de860ea",sedeId:"507f1f77bcf86cd799439012",actorId:"operator"};
const event={...context,eventId,tipo:"PEDIDO_REGISTRADO",status:"PENDIENTE",
 payload:{localOrderId:eventId,items:[{productoId:productId,cantidad:"2",precioUnitarioCop:"3000",totalCop:"6000"}],totalCop:"6000"}};
function mock(stock=1){
 let writes=0;let stored=null;
 return {db:{collection(name){
  if(name==="gruk_offline_inbox")return {find(query){
   assert.equal(query.empresaId,context.empresaId);assert.equal(query.actorId,context.actorId);
   return {toArray:async()=>[event]};
  }};
  if(name==="inventarios")return {find(query){
   assert.equal(query.empresaId,context.empresaId);assert.equal(query.sedeId,context.sedeId);
   assert.equal(query.productoServicioId,productId);
   return {toArray:async()=>[{_id:"inventory",empresaId:context.empresaId,sedeId:context.sedeId,productoServicioId:productId,anulado:false,cantidad:stock}]};
  }};
  if(name==="gruk_offline_stock_conflicts")return {
   async updateOne(key,update,options){
    writes++;assert.equal(options.upsert,true);
    if(!stored)stored=update.$setOnInsert;
    return writes===1?{upsertedCount:1}:{matchedCount:1};
   },
   async findOne(key){assert.equal(key.actorId,context.actorId);return stored;}
  };
  throw Error("UNEXPECTED_COLLECTION_"+name);
 }},get writes(){return writes;}};
}
test("oversell audit: projected deficit is preserved, and repeated requests use ONE conflict",async()=>{
 const fixture=mock(1);
 const args={db:fixture.db,context,eventIds:[eventId],objectId:x=>x};
 const first=await record(args),again=await record(args);
 assert.equal(first.status,"REQUIERE_REVISION_STOCK");
 assert.equal(first.applied,false);assert.equal(first.cobrado,false);
 assert.deepEqual(first.issues,[{productoId:productId,disponible:"1",solicitado:"2",faltante:"1"}]);
 assert.equal(first.conflictId,again.conflictId);
 assert.deepEqual(first.issues,again.issues);
 assert.equal(fixture.writes,2);
});
test("oversell audit: cannot manufacture a shortage where server stock is sufficient",async()=>{
 await assert.rejects(record({db:mock(2).db,context,eventIds:[eventId],objectId:x=>x}),
 e=>e.code==="OFFLINE_STOCK_CONFLICT_NO_LONGER_PRESENT");
});
test("oversell audit: cross-tenant identity and duplicate events reject before writes",async()=>{
 const fixture=mock(1);
 await assert.rejects(record({db:fixture.db,context,eventIds:[eventId,eventId],objectId:x=>x}),
  /OFFLINE_INVALID_IDS/);
 await assert.rejects(record({db:fixture.db,context:{...context,empresaId:"$ne"},
  eventIds:[eventId],objectId:x=>x}),/OFFLINE_STOCK_AUDIT_UNAVAILABLE/);
 assert.equal(fixture.writes,0);
});

test("Capa 2: foreign or deleted inventory evidence cannot create oversell audits",async()=>{
 const patches=[
  {empresaId:"507f191e810c19729de860eb"},
  {sedeId:"507f1f77bcf86cd799439013"},
  {productoServicioId:"507f1f77bcf86cd799439014"},
  {empresaId:undefined},{sedeId:undefined},{productoServicioId:undefined},
  {anulado:true},{anulado:undefined}
 ];
 for(const patch of patches){
  const source=mock(1);
  const db={collection(name){
   const collection=source.db.collection(name);
   if(name!=="inventarios")return collection;
   return {find(query,options){
    assert.equal(query.empresaId,context.empresaId);
    assert.equal(query.sedeId,context.sedeId);
    assert.equal(options.projection.empresaId,1);
    assert.equal(options.projection.sedeId,1);
    assert.equal(options.projection.productoServicioId,1);
    assert.equal(options.projection.anulado,1);
    return {toArray:async()=>[{_id:"inventory",empresaId:context.empresaId,
     sedeId:context.sedeId,productoServicioId:productId,anulado:false,
     cantidad:1,...patch}]};
   }};
  }};
  await assert.rejects(record({db,context,eventIds:[eventId],objectId:x=>x}),
   {code:"OFFLINE_STOCK_AUDIT_MAPPING_UNAVAILABLE"});
  assert.equal(source.writes,0);
 }
});
