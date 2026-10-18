"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {readOfflineReconciliation}=require("../../core/offline/offlineReconciliation.service");
const id="01ARZ3NDEKTSV4RRFFQ69G5FA0";
const a={empresaId:"empresa-A",sedeId:"sede-A",actorId:"usuario-A"};
const b={empresaId:"empresa-B",sedeId:"sede-B",actorId:"usuario-A"};
const evidence={
 gruk_offline_inbox:{eventId:id,status:"APLICADO",inventoryApplied:true},
 gruk_offline_ventas:{eventId:id,status:"CONTABILIZADA",totalCop:"5000"},
 gruk_offline_caja_intenciones:{eventId:id,status:"CONCILIADO",cobrado:true,montoCop:"5000"},
 gruk_ledger_movimientos:{eventId:id,tipo:"VENTA_OFFLINE",montoCop:"5000",deletedAt:null}
};
function adapter(override={}) {
 const queries=[];
 return {queries,collection(name){
  assert.ok(evidence[name]);
  return {find(query,options){
   queries.push({name,query,projection:options.projection});
   assert.equal(query.empresaId,a.empresaId);
   assert.equal(query.sedeId,a.sedeId);
   return {async toArray(){return [{...a,...evidence[name],...(override[name]||{})}];}};
  }};
 }};
}
test("Capa 2: correct tenant evidence reconciles only when all four journals agree",async()=>{
 const db=adapter();
 const [result]=await readOfflineReconciliation({db,context:a,eventIds:[id]});
 assert.equal(result.applied,true);
 assert.equal(result.financiallyReconciled,true);
 assert.equal(db.queries.length,4);
 assert.ok(db.queries.every(q=>q.projection.empresaId===1&&q.projection.sedeId===1));
});
test("Capa 2: foreign evidence supplied by faulty cache must never reconcile",async()=>{
 for(const name of Object.keys(evidence)){
  const db=adapter({[name]:{empresaId:b.empresaId,sedeId:b.sedeId}});
  const [result]=await readOfflineReconciliation({db,context:a,eventIds:[id]});
  assert.equal(result.applied,false,name);
  assert.equal(result.financiallyReconciled,false,name);
 }
});
test("Capa 2: evidence missing tenant identity is never financial proof",async()=>{
 for(const name of Object.keys(evidence)){
  const db=adapter({[name]:{empresaId:undefined}});
  const [result]=await readOfflineReconciliation({db,context:a,eventIds:[id]});
  assert.equal(result.applied,false,name);
 }
});
test("Capa 2: poisoned duplicate cannot be overwritten by good evidence",async()=>{
 const db={collection(name){return {find(){return {async toArray(){
  const row={...a,...evidence[name]};
  return name==="gruk_offline_ventas"?[{...row,empresaId:b.empresaId},row]:[row];
 }};}};}};
 const [result]=await readOfflineReconciliation({db,context:a,eventIds:[id]});
 assert.equal(result.applied,false);
 assert.equal(result.staged,false);
});
