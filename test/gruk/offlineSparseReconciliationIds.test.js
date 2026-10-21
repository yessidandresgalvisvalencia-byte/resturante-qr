"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {readOfflineReconciliation}=require("../../core/offline/offlineReconciliation.service");
const {readOfflineStatuses}=require("../../core/offline/offlineStatus.service");
const context={empresaId:"empresa",sedeId:"sede",actorId:"actor"};
const id="01ARZ3NDEKTSV4RRFFQ69G5FA0";
test("Capa 2: IDs dispersos no alcanzan la base de datos de conciliación",async()=>{
 for(const ids of [new Array(1),[id,,id],Array(2)]){
  let calls=0;
  const db={collection(){calls++;throw Error("UNEXPECTED_QUERY");}};
  await assert.rejects(readOfflineReconciliation({db,context,eventIds:ids}),
   {code:"OFFLINE_INVALID_IDS"});
  await assert.rejects(readOfflineStatuses({db,context,eventIds:ids}),
   {code:"OFFLINE_INVALID_IDS"});
  assert.equal(calls,0);
 }
});
test("Capa 2: lista completa válida mantiene consulta por empresa, sede y actor",async()=>{
 const names=[];
 const db={collection(name){names.push(name);return {find(filter){
  assert.equal(filter.empresaId,context.empresaId);
  assert.equal(filter.sedeId,context.sedeId);
  assert.deepEqual(filter.eventId,{$in:[id]});
  if(name==="gruk_offline_inbox")assert.equal(filter.actorId,context.actorId);
  return {toArray:async()=>[]};
 }};}};
 const result=await readOfflineReconciliation({db,context,eventIds:[id]});
 assert.deepEqual(result,[{eventId:id,status:"NO_ENCONTRADO",applied:false,staged:false,financiallyReconciled:false}]);
 assert.equal(names.length,4);
});
