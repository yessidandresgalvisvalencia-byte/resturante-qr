"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {preflightOfflineConflict:preflight}=require("../../core/offline/offlineConflictPreflight.service");
const auth={empresaId:"507f191e810c19729de860ea",sedeId:"507f1f77bcf86cd799439012",
 usuarioId:"admin",rol:"ADMIN_SEDE"};
const conflictId="offline-stock-"+"a".repeat(64);
const productId="507f1f77bcf86cd799439011",eventId="01ARZ3NDEKTSV4RRFFQ69G5FA0";
function setup(stock,pendiente=true,stockPatch={}){
 let reads=0,writes=0;
 const db={collection(name){
  if(name==="gruk_offline_stock_conflicts")return {async findOne(query){
   reads++;assert.equal(query.empresaId,auth.empresaId);assert.equal(query.sedeId,auth.sedeId);
   return {_id:conflictId,empresaId:auth.empresaId,sedeId:auth.sedeId,status:"REQUIERE_REVISION",applied:false,cobrado:false,actorId:"operator",eventIds:[eventId]};}};
  if(name==="gruk_offline_inbox")return {find(q){
   reads++;assert.equal(q.actorId,"operator");assert.equal(q.empresaId,auth.empresaId);
   return {toArray:async()=>pendiente?[{
    eventId,...{empresaId:auth.empresaId,sedeId:auth.sedeId,actorId:"operator"},
    tipo:"PEDIDO_REGISTRADO",status:"PENDIENTE",payload:{localOrderId:eventId,
     items:[{productoId:productId,cantidad:"1",precioUnitarioCop:"3000",totalCop:"3000"}],totalCop:"3000"}
   }]:[]};}};
  if(name==="inventarios")return {find(q){
   reads++;assert.equal(q.empresaId,auth.empresaId);assert.equal(q.sedeId,auth.sedeId);
   return {toArray:async()=>stock===null?[]:[{_id:"stock-a",empresaId:auth.empresaId,sedeId:auth.sedeId,productoServicioId:productId,anulado:false,cantidad:stock,...stockPatch}]};}};
  throw Error("UNEXPECTED_COLLECTION_"+name);
 }};
 return {db,get reads(){return reads;},get writes(){return writes;}};
}
test("offline conflict preflight: must be read-only and reveal if server stock is enough",async()=>{
 const available=setup(2);
 const a=await preflight({db:available.db,auth,conflictId,objectId:id=>id});
 assert.equal(a.ready,true);assert.equal(a.applied,false);assert.equal(a.cobrado,false);
 assert.equal(a.inventoryChanges,false);assert.equal(a.products[0].shortage,"0");
 const short=setup(0);
 const b=await preflight({db:short.db,auth,conflictId,objectId:id=>id});
 assert.equal(b.ready,false);assert.equal(b.products[0].shortage,"1");
 assert.equal(available.writes+short.writes,0);
});
test("offline conflict preflight: missing stock mapping and nonpending events fail closed",async()=>{
 const missing=await preflight({db:setup(null).db,auth,conflictId,objectId:id=>id});
 assert.equal(missing.ready,false);assert.equal(missing.products[0].reason,"STOCK_SIN_MAPEO");
 const stale=await preflight({db:setup(1,false).db,auth,conflictId,objectId:id=>id});
 assert.equal(stale.ready,false);assert.equal(stale.reason,"EVENTOS_NO_PENDIENTES");
 assert.deepEqual(stale.products,[]);
});
test("offline conflict preflight: employee, bad tenant and unknown id rejected before queries",async()=>{
 const s=setup(1);
 for(const bad of [{...auth,rol:"EMPLEADO"},{...auth,empresaId:"$ne"}])
  await assert.rejects(preflight({db:s.db,auth:bad,conflictId,objectId:id=>id}),
   /OFFLINE_CONFLICT_PERMISSION_DENIED/);
 await assert.rejects(preflight({db:s.db,auth,conflictId:"bad",objectId:id=>id}),
  /OFFLINE_CONFLICT_INVALID_ID/);
 assert.equal(s.reads,0);
});

test("Capa 2: foreign stock evidence never makes conflict ready or exposes its quantity",async()=>{
 for(const patch of [{empresaId:"507f191e810c19729de860eb"},
   {sedeId:"507f1f77bcf86cd799439013"},
   {productoServicioId:"507f1f77bcf86cd799439014"},
   {anulado:true},{empresaId:undefined},{sedeId:undefined},
   {productoServicioId:undefined},{anulado:undefined}]){
  const fixture=setup(999,true,patch);
  const result=await preflight({db:fixture.db,auth,conflictId,objectId:id=>id});
  assert.equal(result.ready,false);
  assert.equal(result.products[0].reason,"STOCK_SIN_MAPEO");
  assert.equal(result.products[0].available,null);
  assert.equal(result.products[0].shortage,null);
  assert.equal(fixture.writes,0);
 }
});
