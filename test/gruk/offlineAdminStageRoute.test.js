"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const vm=require("node:vm"),fs=require("node:fs"),path=require("node:path");
const source=fs.readFileSync(path.join(__dirname,"../../routes/sync.js"),"utf8");
function load({dbReady=true,stage}={}){
 const handlers={};let calls=0;
 const db={client:{startSession:()=>({})}};
 const imports={
  express:{Router:()=>({post(url,...fns){handlers[url]=fns.at(-1);},get(url,...fns){handlers[url]=fns.at(-1);}})},
  mongoose:{connection:{readyState:dbReady?1:0,db}},
  "../core/auth/auth.middleware":()=>{},
  "../core/offline/offlineInbox.service":{acceptOfflineBatch:async()=>[],ensureInboxIndexes:async()=>{}},
  "../core/offline/offlineStatus.service":{readOfflineStatuses:async()=>[]},
  "../core/offline/offlineReconciliation.service":{readOfflineReconciliation:async()=>[]},
  "../core/offline/offlineAdminStage.service":{async stageAuthorizedOfflineOrders(args){calls++;return stage(args);}}
 };
 const module={exports:{}};
 vm.runInNewContext(source,{module,exports:module.exports,require:name=>imports[name],console});
 return {handler:handlers["/stage-orders"],db,get calls(){return calls;}};
}
const auth={empresaId:"507f191e810c19729de860ea",sedeId:"507f1f77bcf86cd799439012",
 usuarioId:"admin",rol:"ADMIN_SEDE"};
const eventId="01ARZ3NDEKTSV4RRFFQ69G5FA0";
async function send(handler,authValue=auth,body={eventIds:[eventId],confirmed:true}){
 let code=200,answer,cache;
 await handler({auth:authValue,body},{status(n){code=n;return this;},
  set(k,v){if(k==="Cache-Control")cache=v;return this;},
  json(v){answer=v;return this;}});
 return {code,answer,cache};
}
test("stage-orders: employee forbidden BEFORE staging service is invoked",async()=>{
 const f=load({stage:()=>{throw Error("MUST_NOT_STAGE");}});
 const r=await send(f.handler,{...auth,rol:"EMPLEADO"});
 assert.equal(r.code,403);assert.equal(f.calls,0);
});
test("stage-orders: successful admin posting explicitly remains unpaid and not APPLIED",async()=>{
 const f=load({stage:async ({auth:received,confirmed,eventIds,db})=>{
  assert.equal(received.rol,"ADMIN_SEDE");assert.equal(db,f.db);
  assert.equal(confirmed,true);assert.equal(eventIds[0],eventId);
  return {status:"PENDIENTE_CONTABILIZACION",cobrado:false,applied:false,processedEvents:1,stockMovements:1,totalCop:"3000"};
 }});
 const r=await send(f.handler);
 assert.equal(r.code,202);assert.equal(r.cache,"no-store");assert.equal(r.answer.cobrado,false);
 assert.equal(r.answer.applied,false);assert.equal(f.calls,1);
});
test("stage-orders: replay and missing index fail closed without payment",async()=>{
 for(const [errorCode,status] of [["OFFLINE_INVENTORY_REPLAY_REQUIRES_RECONCILIATION",409],["OFFLINE_INDEX_NOT_READY",503],
  ["OFFLINE_INVALID_IDS",400],["OFFLINE_STAGE_CONFIRMATION_REQUIRED",400]]){
  const f=load({stage:async()=>{throw Object.assign(new Error(errorCode),{code:errorCode});}});
  const r=await send(f.handler);
  assert.equal(r.code,status);assert.equal(r.answer.ok,false);assert.equal(r.answer.error,errorCode);
 }
});
test("stage-orders: Mongo disconnected returns 503 before any domain call",async()=>{
 const f=load({dbReady:false,stage:()=>{throw Error("MUST_NOT_STAGE");}});
 const r=await send(f.handler);assert.equal(r.code,503);assert.equal(f.calls,0);
});

test("stage-orders: idempotent recovery returns 200 without confirming a payment",async()=>{
 const f=load({stage:async()=>({status:"PENDIENTE_CONTABILIZACION",alreadyStaged:true,
  cobrado:false,applied:false,processedEvents:1,totalCop:"3000"})});
 const response=await send(f.handler);
 assert.equal(response.code,200);
 assert.equal(response.answer.alreadyStaged,true);
 assert.equal(response.answer.applied,false);
 assert.equal(response.answer.cobrado,false);
 assert.equal(f.calls,1);
});
