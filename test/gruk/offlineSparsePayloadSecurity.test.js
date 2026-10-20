"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {validateBatch}=require("../../core/offline/offlineBatch.contract");
const {acceptOfflineBatch}=require("../../core/offline/offlineInbox.service");
const context={empresaId:"empresa",sedeId:"sede",actorId:"operador"};
const event={eventId:"01ARZ3NDEKTSV4RRFFQ69G5FA0",...context,
 deviceId:"tablet_1",tipo:"PEDIDO_REGISTRADO",
 occurredAt:"2026-10-20T10:00:00.000Z",schemaVersion:1,
 payload:{pedidoId:"local_1",items:[{productoId:"507f1f77bcf86cd799439011",cantidad:"1"}]}};
test("Capa 2: el contrato rechaza lotes con posiciones omitidas",()=>{
 for(const events of [new Array(1),[event,,event]]){
  assert.throws(()=>validateBatch(events,context),{code:"OFFLINE_INVALID_EVENT"});
 }
});
test("Capa 2: ningún payload con artículos dispersos supera validación",async()=>{
 for(const items of [new Array(1),[event.payload.items[0],,event.payload.items[0]]]){
  const corrupted={...event,payload:{...event.payload,items}};
  assert.throws(()=>validateBatch([corrupted],context),{code:"OFFLINE_INVALID_PAYLOAD"});
  let dbCalls=0;
  const db={collection(){dbCalls++;throw Error("UNEXPECTED_DB_ACCESS");}};
  await assert.rejects(acceptOfflineBatch({db,authenticatedContext:context,events:[corrupted]}),
   {code:"OFFLINE_INVALID_PAYLOAD"});
  assert.equal(dbCalls,0);
 }
});
test("Capa 2: arrays completos y eventos legítimos siguen siendo válidos",()=>{
 assert.equal(validateBatch([event],context).length,1);
 const two={...event,eventId:"01ARZ3NDEKTSV4RRFFQ69G5FA1"};
 assert.equal(validateBatch([event,two],context).length,2);
});
