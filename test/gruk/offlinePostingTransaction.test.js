"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {executeOfflinePostingTransaction:execute}=require("../../core/offline/offlinePostingTransaction.service");
const id="01ARZ3NDEKTSV4RRFFQ69G5FA0",product="507f1f77bcf86cd799439011";
const context={empresaId:"507f191e810c19729de860ea",sedeId:"507f1f77bcf86cd799439012",actorId:"cajero"};
const event={...context,eventId:id,tipo:"PEDIDO_REGISTRADO",status:"PENDIENTE",payload:{localOrderId:id,items:[{productoId:product,cantidad:"1",precioUnitarioCop:"3000",totalCop:"3000"}],totalCop:"3000"}};
function createDb(){
 let closed=false,committed=false;
 const session={withTransaction:async(fn,opts)=>{assert.equal(opts.readConcern.level,"snapshot");await fn();committed=true;},endSession:async()=>{closed=true;}};
 const db={client:{startSession:()=>session},collection:name=>({find:(q,opts)=>{assert.equal(opts.session,session);return {toArray:async()=>name==="gruk_offline_inbox"?[event]:[{_id:product,empresaId:context.empresaId,sedeId:context.sedeId,activo:true}]};}})};
 return {db,session,state:()=>({closed,committed})};
}
test("posteo por callback recibe plan y sesión dentro de misma transacción",async()=>{
 const fixture=createDb();let called=false;
 const result=await execute({db:fixture.db,context,eventIds:[id],objectId:x=>x,
 postDomainOperations:async({plan,session})=>{called=true;assert.equal(session,fixture.session);assert.equal(plan.totalCop,"3000");return "POSTED";}});
 assert.equal(result,"POSTED");assert.equal(called,true);assert.deepEqual(fixture.state(),{closed:true,committed:true});
});
test("sin aplicador explícito rechaza operación antes de iniciar sesión",async()=>{
 await assert.rejects(execute({db:{},context,eventIds:[id],objectId:x=>x}),e=>e.code==="OFFLINE_POSTER_REQUIRED");
});
test("fallo de posteo interrumpe transacción y libera sesión",async()=>{
 const fixture=createDb();
 await assert.rejects(execute({db:fixture.db,context,eventIds:[id],objectId:x=>x,
 postDomainOperations:async()=>{throw Error("DOMAIN_POSTING_FAILED");}}),/DOMAIN_POSTING_FAILED/);
 assert.deepEqual(fixture.state(),{closed:true,committed:false});
});

test("aplicador recibe los deltas de inventario dentro de la transacción",async()=>{
 const fixture=createDb();
 const result=await execute({db:fixture.db,context,eventIds:[id],objectId:x=>x,
 postDomainOperations:async({plan,inventoryDeltas,session})=>{
  assert.equal(plan.totalCop,"3000");
  assert.equal(session,fixture.session);
  assert.deepEqual(inventoryDeltas,[{productoId:product,deltaUnidades:"-1"}]);
  return "PREPARADO";
 }});
 assert.equal(result,"PREPARADO");
 assert.equal(fixture.state().committed,true);
});

test("posteo sin resultado explícito aborta transacción y libera sesión",async()=>{
 const fixture=createDb();
 await assert.rejects(execute({db:fixture.db,context,eventIds:[id],objectId:x=>x,
 postDomainOperations:async()=>undefined}),e=>e.code==="OFFLINE_POSTER_OUTCOME_REQUIRED");
 assert.deepEqual(fixture.state(),{closed:true,committed:false});
});

test("Capa 2: posting rejects forged tenants and sparse events before opening session",async()=>{
 const other="01ARZ3NDEKTSV4RRFFQ69G5FA1";
 const cases=[
  {context:{...context,empresaId:{$ne:null}},eventIds:[id],objectId:x=>x},
  {context:{...context,sedeId:"foreign"},eventIds:[id],objectId:x=>x},
  {context:{...context,actorId:"$admin"},eventIds:[id],objectId:x=>x},
  {context:null,eventIds:[id],objectId:x=>x},
  {context,eventIds:new Array(1),objectId:x=>x},
  {context,eventIds:[id,,other],objectId:x=>x},
  {context,eventIds:[id,id],objectId:x=>x},
  {context,eventIds:["not-an-ulid"],objectId:x=>x},
  {context,eventIds:[id],objectId:null}
 ];
 for(const args of cases){
  let sessions=0;
  const db={client:{startSession(){sessions++;throw Error("UNAUTHORIZED_SESSION");}}};
  await assert.rejects(execute({db,...args,
   postDomainOperations:async()=>{throw Error("UNAUTHORIZED_POST");}}),
   {code:"OFFLINE_POSTING_TENANT_REQUIRED"});
  assert.equal(sessions,0);
 }
});

test("Capa 2: getters de identidad e indices ULID nunca abren sesión Mongo",async()=>{
 for(const field of ["empresaId","sedeId","actorId"]){
  let getters=0,sessions=0;
  const poisoned={...context};
  Object.defineProperty(poisoned,field,{enumerable:true,configurable:true,
   get(){getters++;return context[field];}});
  const db={client:{startSession(){sessions++;throw Error("SESSION_BEFORE_AUTH");}}};
  await assert.rejects(execute({db,context:poisoned,eventIds:[id],
   objectId:x=>x,postDomainOperations:async()=>true}),
   {code:"OFFLINE_POSTING_TENANT_REQUIRED"});
  assert.equal(getters,0,field);
  assert.equal(sessions,0,field);
 }
 let accesses=0,sessions=0;
 const poisonedIds=[id];
 Object.defineProperty(poisonedIds,0,{enumerable:true,configurable:true,
  get(){accesses++;return id;}});
 await assert.rejects(execute({db:{client:{startSession(){sessions++;}}},
  context,eventIds:poisonedIds,objectId:x=>x,postDomainOperations:async()=>true}),
  {code:"OFFLINE_POSTING_TENANT_REQUIRED"});
 assert.equal(accesses,0);
 assert.equal(sessions,0);
});
test("Capa 2: contexto e IDs quedan estables tras abrir sesión transaccional",async()=>{
 let closed=false,posted=false;
 const originalContext={...context};
 const originalIds=[id];
 let reads=0;
 const session={
  withTransaction:async(fn)=>{await fn();},
  endSession:async()=>{closed=true;}
 };
 const db={
  client:{startSession(){
   Object.assign(originalContext,{empresaId:"000000000000000000000000",
    sedeId:"111111111111111111111111",actorId:"intruso"});
   originalIds[0]="01ARZ3NDEKTSV4RRFFQ69G5FA1";
   return session;
  }},
  collection(name){return {find(query,opts){
   assert.equal(opts.session,session);
   reads++;
   if(name==="gruk_offline_inbox"){
    assert.equal(query.empresaId,context.empresaId);
    assert.equal(query.sedeId,context.sedeId);
    assert.deepEqual(query.eventId.$in,[id]);
    return {toArray:async()=>[event]};
   }
   assert.equal(query.empresaId,context.empresaId);
   return {toArray:async()=>[{_id:product,empresaId:context.empresaId,
    sedeId:context.sedeId,activo:true}]};
  }};}
 };
 const outcome=await execute({db,context:originalContext,eventIds:originalIds,
  objectId:x=>x,postDomainOperations:async({context:scope,plan,session:s})=>{
   posted=true;
   assert.equal(s,session);
   assert.equal(scope.empresaId,context.empresaId);
   assert.equal(scope.sedeId,context.sedeId);
   assert.equal(scope.actorId,context.actorId);
   assert.equal(Object.isFrozen(scope),true);
   assert.equal(plan.totalCop,"3000");
   return "POSTED";
  }});
 assert.equal(outcome,"POSTED");
 assert.equal(posted,true);
 assert.equal(closed,true);
 assert(reads>=2);
});
