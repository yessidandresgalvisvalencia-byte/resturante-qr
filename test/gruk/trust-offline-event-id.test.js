"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const {validateBatch}=require("../../core/offline/offlineBatch.contract");
const context={empresaId:"tenant",sedeId:"site",actorId:"actor"};
const id="01ARZ3NDEKTSV4RRFFQ69G5FAV";
const event={...context,eventId:id,deviceId:"tablet",tipo:"PEDIDO_REGISTRADO",occurredAt:"2026-11-24T12:00:00Z",schemaVersion:1,payload:{}};
test("offline accepts canonical string event ID",()=>assert.equal(validateBatch([event],context)[0].eventId,id));
test("offline rejects coercible IDs",()=>{
 for(const eventId of [[id],{toString:()=>id},null,123]){
  assert.throws(()=>validateBatch([{...event,eventId}],context),{code:"OFFLINE_INVALID_ID"});
 }
});
