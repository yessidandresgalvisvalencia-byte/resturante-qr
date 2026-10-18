"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {recordOfflineOversellConflict}=require("../../core/offline/offlineOversellAudit.service");
const eventId="01ARZ3NDEKTSV4RRFFQ69G5FA0";
const product="507f1f77bcf86cd799439011";
const context={empresaId:"507f191e810c19729de860ea",sedeId:"507f1f77bcf86cd799439012",actorId:"operator"};
const event={...context,eventId,tipo:"PEDIDO_REGISTRADO",status:"PENDIENTE",payload:{
 localOrderId:eventId,items:[{productoId:product,cantidad:"2",precioUnitarioCop:"3000",totalCop:"6000"}],totalCop:"6000"
}};
function fake(pollute={}){
 let audited=0;
 const db={collection(name){
  if(name==="gruk_offline_inbox")return {find(query){assert.equal(query.empresaId,context.empresaId);
   assert.equal(query.sedeId,context.sedeId);assert.equal(query.actorId,context.actorId);
   return {async toArray(){return [event];}};
  }};
  if(name==="inventarios")return {find(query){assert.equal(query.empresaId,context.empresaId);
   assert.equal(query.sedeId,context.sedeId);
   return {async toArray(){return [{_id:"stock-1",cantidad:1}];}};
  }};
  if(name==="gruk_offline_stock_conflicts")return {
   async updateOne(key,update,opts){
    audited++;assert.equal(opts.upsert,true);
    assert.equal(key.empresaId,context.empresaId);
    assert.equal(key.sedeId,context.sedeId);
    return {upsertedCount:1};
   },
   async findOne(key,opts){
    assert.equal(opts.projection.empresaId,1);
    assert.equal(opts.projection.sedeId,1);
    assert.equal(opts.projection.actorId,1);
    return {...key,eventIds:[eventId],issues:[{productoId:product,disponible:"1",solicitado:"2",faltante:"1"}],
     status:"REQUIERE_REVISION",applied:false,cobrado:false,...pollute};
   }
  };
  throw Error("UNEXPECTED_COLLECTION");
 }};
 return {db,get audits(){return audited;}};
}
const args=db=>({db,context,eventIds:[eventId],objectId:x=>x});
test("Capa 2: genuine tenant-scoped stock conflict is returned",async()=>{
 const stub=fake();const result=await recordOfflineOversellConflict(args(stub.db));
 assert.equal(result.status,"REQUIERE_REVISION_STOCK");
 assert.equal(result.cobrado,false);
 assert.equal(stub.audits,1);
});
test("Capa 2: returned audit conflict from other tenant, site or actor is denied",async()=>{
 for(const poisoned of [{empresaId:"507f191e810c19729de860eb"},
   {sedeId:"507f1f77bcf86cd799439013"},{actorId:"foreign"},
   {empresaId:undefined},{sedeId:undefined},{actorId:undefined},
   {_id:"offline-stock-foreign"}]){
  const stub=fake(poisoned);
  await assert.rejects(recordOfflineOversellConflict(args(stub.db)),{
   code:"OFFLINE_STOCK_AUDIT_PERSISTENCE_FAILED"
  });
  assert.equal(stub.audits,1);
 }
});
