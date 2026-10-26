"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {saveOfflineOrder}=require("../../public/js/gruk-offline-draft.js");
const identity={empresaId:"empresaA",sedeId:"sedeA",actorId:"actorA"};
const base={context:identity,deviceId:"tablet1",productoId:"507f1f77bcf86cd799439011",
 cantidad:"1",precioUnitarioCop:"3000",
 cryptoSource:{getRandomValues:array=>{array.fill(3);return array;}}};
test("Capa 2: sesión cerrada antes de guardar nunca escribe IndexedDB",async()=>{
 let writes=0;
 await assert.rejects(saveOfflineOrder({...base,isSessionCurrent:()=>false,
  outbox:{putPending:async()=>{writes++;return "unreachable";}}}),
  {message:"OFFLINE_DRAFT_SESSION_CHANGED"});
 assert.equal(writes,0);
});
test("Capa 2: sesión caduca durante preparación y falla antes de escribir",async()=>{
 let checks=0,writes=0;
 await assert.rejects(saveOfflineOrder({...base,isSessionCurrent:()=>++checks===1,
  outbox:{putPending:async()=>{writes++;}}}),{message:"OFFLINE_DRAFT_SESSION_CHANGED"});
 assert.equal(checks,2);assert.equal(writes,0);
});
test("Capa 2: sesión caduca tras commit local conserva evento y rechaza acuse visual",async()=>{
 let current=true,committed;
 const outbox={putPending:async event=>{
  committed=event;current=false;return event.eventId;
 }};
 await assert.rejects(saveOfflineOrder({...base,outbox,
  isSessionCurrent:()=>current}),{message:"OFFLINE_DRAFT_SESSION_CHANGED_AFTER_SAVE"});
 assert.equal(committed.empresaId,identity.empresaId);
 assert.equal(committed.payload.totalCop,"3000");
});
test("Capa 2: identidad vigente confirma solo tras commit en IndexedDB",async()=>{
 let writes=0;
 const result=await saveOfflineOrder({...base,isSessionCurrent:()=>true,
  outbox:{putPending:async event=>{writes++;return event.eventId;}}});
 assert.equal(writes,1);
 assert.equal(result.status,"pending");assert.equal(result.totalCop,"3000");
});
