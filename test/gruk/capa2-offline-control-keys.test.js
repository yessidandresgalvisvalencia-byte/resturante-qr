"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {validateBatch}=require("../../core/offline/offlineBatch.contract");
const ctx={empresaId:"empresa-1",sedeId:"sede-1",actorId:"actor-1"};
const base={...ctx,eventId:"01ARZ3NDEKTSV4RRFFQ69G5FAV",deviceId:"tablet-1",
 tipo:"PEDIDO_REGISTRADO",occurredAt:"2026-10-29T18:30:00-05:00",schemaVersion:1};
test("Capa 2: rechaza controles ASCII en cualquier nivel del payload offline",()=>{
 for(const key of ["linea\nextra","columna\totra","abc\u0000def","abc\u001fdef","abc\u007fdef"]){
  for(const payload of [{[key]:"valor"},{productos:[{[key]:"valor"}]}]){
   assert.throws(()=>validateBatch([{...base,payload}],ctx),{code:"OFFLINE_UNSAFE_KEY"});
  }
 }
});
test("Capa 2: permite claves JSON normales sin mutaciones",()=>{
 const payload={localOrderId:"p-1",productos:[{precioCop:"1200",cantidad:1}]};
 const [event]=validateBatch([{...base,payload}],ctx);
 assert.deepEqual(event.payload,payload);
});
