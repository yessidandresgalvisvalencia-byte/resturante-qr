"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {recordOfflineOversellConflict:record}=require("../../core/offline/offlineOversellAudit.service");
const eventId="01ARZ3NDEKTSV4RRFFQ69G5FA0";
const productId="507f1f77bcf86cd799439011";
const context={empresaId:"507f191e810c19729de860ea",sedeId:"507f1f77bcf86cd799439012",actorId:"operator"};
const event={...context,eventId,tipo:"PEDIDO_REGISTRADO",status:"PENDIENTE",
 payload:{localOrderId:eventId,items:[{productoId:productId,cantidad:"2",precioUnitarioCop:"3000",totalCop:"6000"}],totalCop:"6000"}};
function mock(stock=1,writeResponse=null){
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
    return writeResponse??(writes===1?{acknowledged:true,upsertedCount:1,matchedCount:0}:
     {acknowledged:true,upsertedCount:0,matchedCount:1});
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

test("Capa 2: auditoría no afirma persistencia con acuse Mongo incompleto o falso",async()=>{
 const invalid=[{}, {upsertedCount:1,matchedCount:0},
  {acknowledged:false,upsertedCount:1,matchedCount:0},
  {acknowledged:1,upsertedCount:1,matchedCount:0},
  {acknowledged:true,upsertedCount:1,matchedCount:1},
  {acknowledged:true,upsertedCount:2,matchedCount:0},
  {acknowledged:true,upsertedCount:0,matchedCount:0}];
 for(const response of invalid){
  const source=mock(1,response);
  await assert.rejects(record({db:source.db,context,eventIds:[eventId],objectId:x=>x}),
   {code:"OFFLINE_STOCK_AUDIT_PERSISTENCE_FAILED"});
  assert.equal(source.writes,1);
 }
});

test("Capa 2: adaptador ObjectId malicioso no consulta inventario ni crea auditorías",async()=>{
 const foreign="507f191e810c19729de860eb";
 for(const target of [context.empresaId,context.sedeId,productId]){
  let inventoryReads=0,conflictWrites=0;
  const source=mock(1);
  const db={collection(name){
   if(name==="inventarios"){inventoryReads++;throw Error("UNAUTHORIZED_INVENTORY_READ");}
   if(name==="gruk_offline_stock_conflicts"){conflictWrites++;throw Error("UNAUTHORIZED_AUDIT_WRITE");}
   return source.db.collection(name);
  }};
  await assert.rejects(record({db,context,eventIds:[eventId],
   objectId:value=>value===target?foreign:value}),
   {code:"OFFLINE_STOCK_AUDIT_IDENTITY_INVALID"});
  assert.equal(inventoryReads,0);assert.equal(conflictWrites,0);
 }
});
test("Capa 2: conversor ObjectId roto o nulo falla antes de lectura de inventario",async()=>{
 for(const convert of [()=>null,()=>undefined,()=>{throw Error("BAD_ADAPTER");}]){
  let inventoryReads=0;
  const source=mock(1);
  const db={collection(name){
   if(name==="inventarios"){inventoryReads++;throw Error("UNAUTHORIZED_READ");}
   return source.db.collection(name);
  }};
  await assert.rejects(record({db,context,eventIds:[eventId],objectId:convert}),
   {code:"OFFLINE_STOCK_AUDIT_IDENTITY_INVALID"});
  assert.equal(inventoryReads,0);
 }
});

test("Capa 2: auditoría niega adaptador de identidad con operadores antes de leer inventario",async()=>{
 for(const converter of [
  value=>({$ne:null,toString:()=>value}),
  value=>({$eq:value,toString:()=>value}),
  value=>({toString:()=>value}),
  value=>({toHexString:()=>value,toString:()=>value}),
  value=>new String(value),
  value=>[value]
 ]){
  const source=mock(1);
  let inventoryReads=0,conflictWrites=0;
  const db={collection(name){
   if(name==="inventarios"){inventoryReads++;throw Error("FORBIDDEN_INVENTORY_READ");}
   if(name==="gruk_offline_stock_conflicts"){conflictWrites++;throw Error("FORBIDDEN_AUDIT_WRITE");}
   return source.db.collection(name);
  }};
  await assert.rejects(record({db,context,eventIds:[eventId],objectId:converter}),
   {code:"OFFLINE_STOCK_AUDIT_IDENTITY_INVALID"});
  assert.equal(inventoryReads,0);assert.equal(conflictWrites,0);
 }
});
test("Capa 2: auditoría niega _id con operador Mongo sin registrar faltantes",async()=>{
 for(const id of [
  {$ne:null,toString:()=>"inventory"},{$eq:"inventory",toString:()=>"inventory"},
  {toString:()=>"inventory"},["inventory"],new String("inventory"),{}
 ]){
  let writes=0;
  const source=mock(1);
  const db={collection(name){
   if(name==="inventarios")return {find(){return {toArray:async()=>[{
    _id:id,empresaId:context.empresaId,sedeId:context.sedeId,
    productoServicioId:productId,anulado:false,cantidad:1
   }]};}};
   if(name==="gruk_offline_stock_conflicts"){writes++;throw Error("FORBIDDEN_AUDIT_WRITE");}
   return source.db.collection(name);
  }};
  await assert.rejects(record({db,context,eventIds:[eventId],objectId:x=>x}),
   {code:"OFFLINE_STOCK_AUDIT_MAPPING_UNAVAILABLE"});
  assert.equal(writes,0);
 }
});
test("Capa 2: BSON ObjectId legítimo mantiene auditoría y registro idempotente",async()=>{
 const id=value=>({_bsontype:"ObjectId",toHexString:()=>value,toString:()=>value});
 const fixture=mock(1);
 const db={collection(name){
  if(name==="inventarios")return {find(query){
   assert.equal(String(query.empresaId),context.empresaId);
   assert.equal(String(query.sedeId),context.sedeId);
   assert.equal(String(query.productoServicioId),productId);
   return {toArray:async()=>[{
    _id:id("507f1f77bcf86cd799439019"),empresaId:context.empresaId,
    sedeId:context.sedeId,productoServicioId:productId,anulado:false,cantidad:1
   }]};
  }};
  return fixture.db.collection(name);
 }};
 const r=await record({db,context,eventIds:[eventId],objectId:id});
 assert.equal(r.status,"REQUIERE_REVISION_STOCK");
 assert.equal(fixture.writes,1);
 assert.deepEqual(r.issues,[{productoId:productId,disponible:"1",solicitado:"2",faltante:"1"}]);
});

test("Capa 2: auditoría fija tenant e IDs aunque cambien durante la lectura",async()=>{
 const ctx={...context},ids=[eventId];
 const fixture=mock(1);
 let staged=false;
 const db={collection(name){
  const collection=fixture.db.collection(name);
  if(name==="inventarios")return {find(query){
   assert.equal(query.empresaId,context.empresaId);
   Object.assign(ctx,{empresaId:"507f191e810c19729de860eb",
    sedeId:"507f1f77bcf86cd799439013",actorId:"intruso"});
   ids[0]="01ARZ3NDEKTSV4RRFFQ69G5FA1";
   return collection.find(query);
  }};
  if(name==="gruk_offline_stock_conflicts")return {
   updateOne(key,update,options){
    staged=true;
    assert.equal(key.empresaId,context.empresaId);
    assert.equal(key.sedeId,context.sedeId);
    assert.equal(key.actorId,context.actorId);
    assert.deepEqual(update.$setOnInsert.eventIds,[eventId]);
    return collection.updateOne(key,update,options);
   },
   findOne:key=>collection.findOne(key)
  };
  return collection;
 }};
 const result=await record({db,context:ctx,eventIds:ids,objectId:x=>x});
 assert.equal(staged,true);
 assert.equal(result.status,"REQUIERE_REVISION_STOCK");
 assert.deepEqual(result.issues,[{productoId:productId,disponible:"1",
  solicitado:"2",faltante:"1"}]);
});
test("Capa 2: getters de identidad e índices de IDs no ejecutan operaciones",async()=>{
 for(const key of ["empresaId","sedeId","actorId"]){
  let invoked=0,access=0;
  const ctx={...context};
  Object.defineProperty(ctx,key,{enumerable:true,configurable:true,
   get(){invoked++;return context[key];}});
  await assert.rejects(record({db:{get collection(){access++;throw Error("DB_READ");}},
   context:ctx,eventIds:[eventId],objectId:x=>x}),
   {code:"OFFLINE_STOCK_AUDIT_UNAVAILABLE"});
  assert.equal(access,0);
  assert.equal(invoked,0);
 }
 let invoked=0,access=0;
 const ids=[eventId];
 Object.defineProperty(ids,0,{enumerable:true,configurable:true,
  get(){invoked++;return eventId;}});
 await assert.rejects(record({db:{get collection(){access++;throw Error("DB_READ");}},
  context,eventIds:ids,objectId:x=>x}),{code:"OFFLINE_INVALID_IDS"});
 assert.equal(invoked,0);
 assert.equal(access,0);
});
