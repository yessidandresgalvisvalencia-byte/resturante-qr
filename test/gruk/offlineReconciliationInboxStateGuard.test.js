"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {readOfflineReconciliation}=require("../../core/offline/offlineReconciliation.service");
const {readOfflineStatuses}=require("../../core/offline/offlineStatus.service");
const context={empresaId:"empresa",sedeId:"sede",actorId:"actor"};
const eventId="01ARZ3NDEKTSV4RRFFQ69G5FA0";
function fixture(status){
 let queries=0;
 return {get queries(){return queries;},db:{collection(name){
  return {find(filter){
   queries++;
   assert.equal(filter.empresaId,context.empresaId);
   assert.equal(filter.sedeId,context.sedeId);
   if(name==="gruk_offline_inbox")assert.equal(filter.actorId,context.actorId);
   return {toArray:async()=>name==="gruk_offline_inbox"?[{
    eventId,...context,status,inventoryApplied:false
   }]:[]};
  }};
 }}};
}
test("Capa 2: estado persistido desconocido no se expone como reconciliado ni válido",async()=>{
 for(const status of ["RECIBIDO","APLICADO_FALSO","CONCILIADO","",null,undefined,{},true]){
  const f=fixture(status);
  await assert.rejects(readOfflineReconciliation({db:f.db,context,eventIds:[eventId]}),
   {code:"OFFLINE_RECONCILIATION_EVIDENCE_INVALID"});
  await assert.rejects(readOfflineStatuses({db:f.db,context,eventIds:[eventId]}),
   {code:"OFFLINE_STATUS_EVIDENCE_INVALID"});
  assert.equal(f.queries,8);
 }
});
test("Capa 2: estados oficiales mantienen respuesta sin acreditar dinero",async()=>{
 for(const status of ["PENDIENTE","EN_REVISION","RECHAZADO","APLICADO"]){
  const f=fixture(status);
  const [record]=await readOfflineReconciliation({db:f.db,context,eventIds:[eventId]});
  assert.equal(record.status,status);
  assert.equal(record.applied,false);
  assert.equal(record.financiallyReconciled,false);
  assert.equal(record.staged,false);
 }
});
