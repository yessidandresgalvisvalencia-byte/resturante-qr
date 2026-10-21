"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {readOfflineReconciliation}=require("../../core/offline/offlineReconciliation.service");
const context={empresaId:"empresaA",sedeId:"sedeA",actorId:"actorA"};
const id="01ARZ3NDEKTSV4RRFFQ69G5FA0";
const names=["gruk_offline_inbox","gruk_offline_ventas","gruk_offline_caja_intenciones","gruk_ledger_movimientos"];
function dbWithRows(overrides={}){
 const calls=[];
 const db={collection(name){
  assert.ok(names.includes(name));
  return {find(filter,options){
   calls.push({name,filter,options});
   return {toArray:async()=>overrides[name]||[]};
  }};
 }};
 return {db,calls};
}
test("Capa 2: las cuatro lecturas concilian solo el tenant y poseen límite explícito",async()=>{
 const f=dbWithRows();
 await readOfflineReconciliation({db:f.db,context,eventIds:[id]});
 assert.equal(f.calls.length,4);
 for(const {name,filter,options} of f.calls){
  assert.equal(filter.empresaId,context.empresaId);
  assert.equal(filter.sedeId,context.sedeId);
  assert.deepEqual(filter.eventId,{$in:[id]});
  if(name==="gruk_offline_inbox")assert.equal(filter.actorId,context.actorId);
  assert.equal(options.limit,101);
 }
});
test("Capa 2: una colección que devuelve más de 100 evidencias nunca confirma operaciones",async()=>{
 for(const name of names){
  const rows=Array.from({length:101},()=>({...context,eventId:id,status:"APLICADO",inventoryApplied:true}));
  const f=dbWithRows({[name]:rows});
  await assert.rejects(readOfflineReconciliation({db:f.db,context,eventIds:[id]}),
   {code:"OFFLINE_RECONCILIATION_EVIDENCE_INVALID"});
 }
});
test("Capa 2: un evento ausente sigue sin declarar ventas aplicadas",async()=>{
 const f=dbWithRows();
 const [r]=await readOfflineReconciliation({db:f.db,context,eventIds:[id]});
 assert.deepEqual(r,{eventId:id,status:"NO_ENCONTRADO",applied:false,staged:false,financiallyReconciled:false});
});
