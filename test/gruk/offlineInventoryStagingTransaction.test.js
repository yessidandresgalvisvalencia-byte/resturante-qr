"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {executeOfflineInventoryStagingTransaction:execute,assertAppliedOfflineInventory:verifyApplied,assertFreshOfflineStaging:verifyFresh}=require("../../core/offline/offlineInventoryStagingTransaction.service");
test("no inicia sesión ni modifica inventario si faltan índices únicos",async()=>{
 let started=0,inventoryAccess=0;
 const db={client:{startSession(){started++;throw Error("should not start");}},
  collection(){inventoryAccess++;return {indexes:async()=>[]};}};
 await assert.rejects(execute({db,context:{empresaId:"507f191e810c19729de860ea",sedeId:"507f1f77bcf86cd799439012",actorId:"cajero"},eventIds:["01ARZ3NDEKTSV4RRFFQ69G5FA0"],
  objectId:x=>x}),()=>true);
 assert.equal(started,0);assert.ok(inventoryAccess>=1);
});
test("rechaza una base de datos no disponible antes de cualquier operación",async()=>{
 await assert.rejects(execute({db:null,context:{},eventIds:[],objectId:x=>x}),()=>true);
});

test("Capa 2: unscoped and forged inventory staging requests never read any collection",async()=>{
 let calls=0,sessions=0;
 const db={collection(){calls++;throw Error("UNAUTHORIZED_INDEX_READ");},
  client:{startSession(){sessions++;throw Error("UNAUTHORIZED_SESSION");}}};
 const valid={empresaId:"507f191e810c19729de860ea",
  sedeId:"507f1f77bcf86cd799439012",actorId:"cajero"};
 const eventId="01ARZ3NDEKTSV4RRFFQ69G5FA0";
 const checks=[
  {context:null,eventIds:[eventId]},
  {context:{...valid,empresaId:undefined},eventIds:[eventId]},
  {context:{...valid,sedeId:undefined},eventIds:[eventId]},
  {context:{...valid,actorId:undefined},eventIds:[eventId]},
  {context:{...valid,empresaId:"$ne"},eventIds:[eventId]},
  {context:{...valid,sedeId:"other-tenant"},eventIds:[eventId]},
  {context:valid,eventIds:[]},
  {context:valid,eventIds:[eventId,eventId]},
  {context:valid,eventIds:["invalid"]},
  {context:valid,eventIds:[eventId],objectId:null}
 ];
 for(const args of checks){
  await assert.rejects(execute({db,context:args.context,eventIds:args.eventIds,
   objectId:args.objectId===undefined?(value=>value):args.objectId}),
   {code:"OFFLINE_INVENTORY_TENANT_REQUIRED"});
 }
 assert.equal(calls,0);
 assert.equal(sessions,0);
});

test("Capa 2: object-shaped tenant or actor identities never reach staging metadata",async()=>{
 const valid={empresaId:"507f191e810c19729de860ea",
  sedeId:"507f1f77bcf86cd799439012",actorId:"cajero"};
 const eventId="01ARZ3NDEKTSV4RRFFQ69G5FA0";
 for(const field of ["empresaId","sedeId","actorId"]){
  for(const invalid of [{toString:()=>valid[field]},null,undefined,123,[],{}]){
   let collections=0,sessions=0,conversions=0;
   const db={collection(){collections++;throw Error("FORBIDDEN_READ");},
    client:{startSession(){sessions++;throw Error("FORBIDDEN_SESSION");}}};
   await assert.rejects(execute({db,context:{...valid,[field]:invalid},
    eventIds:[eventId],objectId:()=>{conversions++;throw Error("FORBIDDEN_CONVERSION");}}),
    {code:"OFFLINE_INVENTORY_TENANT_REQUIRED"});
   assert.equal(collections,0);assert.equal(sessions,0);assert.equal(conversions,0);
  }
 }
});

test("Capa 2: persisted stock evidence must be safely bounded and exact",()=>{
 const productoId="507f1f77bcf86cd799439011";
 const delta=[{productoId,deltaUnidades:"-2"}];
 assert.equal(verifyApplied([{productoId,antes:"5",despues:"3"}],delta),true);
 for(const invalid of [
  {productoId,antes:"9".repeat(10000),despues:"3"},
  {productoId,antes:"9007199254740993",despues:"9007199254740991"},
  {productoId,antes:"9007199254740992",despues:"9007199254740990"},
  {productoId,antes:"5",despues:"0".repeat(10000)},
  {productoId,antes:"5",despues:"4"},
  {productoId,antes:"3",despues:"5"}
 ]){
  assert.throws(()=>verifyApplied([invalid],delta),
   {code:"OFFLINE_INVENTORY_RESULT_CONFLICT"});
 }
 for(const invalidDelta of ["-9".repeat(10000),"-9007199254740992","-9007199254740993"]){
  assert.throws(()=>verifyApplied([{productoId,antes:"5",despues:"3"}],
    [{productoId,deltaUnidades:invalidDelta}]),
    {code:"OFFLINE_INVENTORY_RESULT_CONFLICT"});
 }
});

test("Capa 2: sparse eventIds are rejected before any database index read",async()=>{
 const context={empresaId:"507f191e810c19729de860ea",
  sedeId:"507f1f77bcf86cd799439012",actorId:"cajero"};
 const valid="01ARZ3NDEKTSV4RRFFQ69G5FA0";
 for(const eventIds of [[valid,,],[,valid],new Array(1)]){
  let reads=0;
  const db={collection(){reads++;throw Error("FORBIDDEN_READ");}};
  await assert.rejects(execute({db,context,eventIds,objectId:x=>x}),
   {code:"OFFLINE_INVENTORY_TENANT_REQUIRED"});
  assert.equal(reads,0);
 }
});
test("Capa 2: sparse staged order and product plans cannot pass journal checks",()=>{
 const eventId="01ARZ3NDEKTSV4RRFFQ69G5FA0",productoId="507f1f77bcf86cd799439011";
 const plan={orders:[{eventId}]},deltas=[{productoId,deltaUnidades:"-1"}];
 const staged={
  sales:{records:[{eventId,inserted:true}]},
  cash:{records:[{eventId,inserted:true}]},
  ledger:{entries:[{eventId,inserted:true}]},
  stock:{records:[{productoId,inserted:true}]}
 };
 assert.equal(verifyFresh(staged,deltas,plan),true);
 for(const bad of [
  {plan:{orders:[plan.orders[0],,plan.orders[0]]},deltas},
  {plan,deltas:[deltas[0],,deltas[0]]},
  {plan:{orders:new Array(1)},deltas},
  {plan,deltas:new Array(1)}
 ]){
  assert.throws(()=>verifyFresh(staged,bad.deltas,bad.plan),
   {code:"OFFLINE_INVENTORY_REPLAY_REQUIRES_RECONCILIATION"});
 }
});
