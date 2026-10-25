"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {recoverOfflineStagedBatch}=require("../../core/offline/offlineStageRecovery.service");
const context={empresaId:"empresaA",sedeId:"sedeA",actorId:"operator"};
const eventId="01ARZ3NDEKTSV4RRFFQ69G5FA0";
const evidence={
 gruk_offline_inbox:{...context,eventId,status:"EN_REVISION",inventoryApplied:true,financialStageStatus:"PENDIENTE_CONTABILIZACION",stagedBy:context.actorId},
 gruk_offline_ventas:{...context,eventId,status:"PENDIENTE_CONTABILIZACION",totalCop:"2000"},
 gruk_offline_caja_intenciones:{...context,eventId,status:"PENDIENTE_CONCILIACION",cobrado:false,montoCop:"2000"},
 gruk_ledger_movimientos:{...context,eventId,tipo:"VENTA_OFFLINE",montoCop:"2000",deletedAt:null}
};
function fixture(poisonName){
 const counts=new Map();
 return {client:{startSession:()=>({
  withTransaction:async(fn,options)=>{
   assert.equal(options.readConcern.level,"snapshot");
   await fn();
  },endSession:async()=>{}
 })},collection(name){
  const number=counts.get(name)||0;counts.set(name,number+1);
  return {find(q){
   assert.equal(q.empresaId,context.empresaId);
   assert.equal(q.sedeId,context.sedeId);
   return {toArray:async()=>{
    // The first read by reconciliation returns a complete, correctly scoped record.
    // Subsequent targeted recovery reads are poisoned to simulate a buggy DB adapter.
    if(number>0&&name===poisonName)return new Array(1);
    return [evidence[name]];
   }};
  }};
 }};
}
test("Capa 2: recuperación confirma la evidencia completa antes de reconocer contabilización",async()=>{
 const result=await recoverOfflineStagedBatch({db:fixture(null),context,eventIds:[eventId]});
 assert.equal(result.alreadyStaged,true);
 assert.equal(result.totalCop,"2000");
 assert.equal(result.applied,false);
 assert.equal(result.cobrado,false);
});
test("Capa 2: recuperación rechaza registros dispersos aun si conciliación inicial era íntegra",async()=>{
 for(const collection of ["gruk_offline_inbox","gruk_offline_ventas","gruk_offline_caja_intenciones"]){
  await assert.rejects(recoverOfflineStagedBatch({db:fixture(collection),context,eventIds:[eventId]}),
   {code:"OFFLINE_STAGE_REPLAY_REQUIRES_REVIEW"},collection);
 }
});
