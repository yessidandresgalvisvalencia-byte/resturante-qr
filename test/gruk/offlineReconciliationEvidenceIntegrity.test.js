"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {readOfflineReconciliation:read}=require("../../core/offline/offlineReconciliation.service");
const context={empresaId:"empresaA",sedeId:"sedeA",actorId:"cajeroA"};
const eventId="01ARZ3NDEKTSV4RRFFQ69G5FA0";
function fixture(patchName,change){
 const rows={
  gruk_offline_inbox:[{...context,eventId,status:"EN_REVISION",inventoryApplied:true}],
  gruk_offline_ventas:[{...context,eventId,status:"PENDIENTE_CONTABILIZACION",totalCop:"1500"}],
  gruk_offline_caja_intenciones:[{...context,eventId,status:"PENDIENTE_CONCILIACION",cobrado:false,montoCop:"1500"}],
  gruk_ledger_movimientos:[{...context,eventId,tipo:"VENTA_OFFLINE",montoCop:"1500",deletedAt:null}]
 };
 if(patchName)change(rows[patchName]);
 let reads=0;
 return {get reads(){return reads;},db:{collection(name){reads++;return {find(query){
   assert.equal(query.empresaId,context.empresaId);
   assert.equal(query.sedeId,context.sedeId);
   return {toArray:async()=>rows[name]};
 }}}}};
}
test("Capa 2: prueba completa queda en staging, nunca cobrada",async()=>{
 const f=fixture();
 assert.deepEqual(await read({db:f.db,context,eventIds:[eventId]}),
  [{eventId,status:"EN_REVISION",staged:true,financiallyReconciled:false,applied:false}]);
 assert.equal(f.reads,4);
});
test("Capa 2: getters ofensivos de cualquier diario son rechazados",async()=>{
 const mapping={
  gruk_offline_inbox:["empresaId","sedeId","actorId","eventId","status","inventoryApplied"],
  gruk_offline_ventas:["empresaId","sedeId","actorId","eventId","status","totalCop"],
  gruk_offline_caja_intenciones:["empresaId","sedeId","actorId","eventId","status","cobrado","montoCop"],
  gruk_ledger_movimientos:["empresaId","sedeId","actorId","eventId","tipo","montoCop","deletedAt"]
 };
 for(const [name,fields] of Object.entries(mapping)){
  for(const field of fields){
   let executed=0;
   const f=fixture(name,records=>Object.defineProperty(records[0],field,{
    configurable:true,enumerable:true,get(){executed++;throw Error("MALICIOUS_GETTER");}
   }));
   await assert.rejects(read({db:f.db,context,eventIds:[eventId]}),
    {code:"OFFLINE_RECONCILIATION_EVIDENCE_INVALID"});
   assert.equal(executed,0,name+"."+field);
  }
 }
});
test("Capa 2: índices de arrays fraudulentos no ejecutan getters",async()=>{
 for(const name of ["gruk_offline_inbox","gruk_offline_ventas",
  "gruk_offline_caja_intenciones","gruk_ledger_movimientos"]){
  for(const mode of ["hole","getter"]){
   let called=0;
   const f=fixture(name,records=>{
    if(mode==="hole")delete records[0];
    else Object.defineProperty(records,0,{configurable:true,enumerable:true,
     get(){called++;throw Error("UNAUTHORIZED_GETTER");}});
   });
   await assert.rejects(read({db:f.db,context,eventIds:[eventId]}),
    {code:"OFFLINE_RECONCILIATION_EVIDENCE_INVALID"});
   assert.equal(called,0);
  }
 }
});
test("Capa 2: registros duplicados o de otra empresa nunca confirman staging",async()=>{
 for(const name of ["gruk_offline_inbox","gruk_offline_ventas",
  "gruk_offline_caja_intenciones","gruk_ledger_movimientos"]){
  for(const mutation of ["duplicate","cross_tenant","cross_actor","missing"]){
   const f=fixture(name,rows=>{
    if(mutation==="duplicate")rows.push({...rows[0]});
    if(mutation==="cross_tenant")rows[0].empresaId="empresaB";
    if(mutation==="cross_actor")rows[0].actorId="cajeroB";
    if(mutation==="missing")rows.length=0;
   });
   const result=await read({db:f.db,context,eventIds:[eventId]});
   assert.equal(result[0].staged,false,name+" "+mutation);
   assert.equal(result[0].financiallyReconciled,false);
   assert.equal(result[0].applied,false);
  }
 }
});

test("Capa 2: Mongo desordenado concilia por eventId, jamás por posición",async()=>{
 const ids=[eventId,"01ARZ3NDEKTSV4RRFFQ69G5FA1"];
 const totals=["1200","3400"];
 const rows={
  gruk_offline_inbox:ids.map(id=>({...context,eventId:id,status:"EN_REVISION",inventoryApplied:true})),
  gruk_offline_ventas:ids.map((id,i)=>({...context,eventId:id,status:"PENDIENTE_CONTABILIZACION",totalCop:totals[i]})),
  gruk_offline_caja_intenciones:ids.map((id,i)=>({...context,eventId:id,status:"PENDIENTE_CONCILIACION",cobrado:false,montoCop:totals[i]})),
  gruk_ledger_movimientos:ids.map((id,i)=>({...context,eventId:id,tipo:"VENTA_OFFLINE",deletedAt:null,montoCop:totals[i]}))
 };
 const db={collection(name){return {find(query){
  assert.equal(query.empresaId,context.empresaId);
  assert.equal(query.sedeId,context.sedeId);
  return {toArray:async()=>name==="gruk_offline_inbox"?rows[name]:
   [...rows[name]].reverse()};
 }}}};
 const valid=await read({db,context,eventIds:ids});
 assert.deepEqual(valid.map(x=>[x.eventId,x.staged]),ids.map(id=>[id,true]));
 assert(valid.every(x=>x.financiallyReconciled===false&&x.applied===false));
 // Both ledgers still sum to the same COP total, but each belongs to the wrong order.
 [rows.gruk_ledger_movimientos[0].montoCop,rows.gruk_ledger_movimientos[1].montoCop]=
  [rows.gruk_ledger_movimientos[1].montoCop,rows.gruk_ledger_movimientos[0].montoCop];
 const swapped=await read({db,context,eventIds:ids});
 assert(swapped.every(x=>x.staged===false&&x.financiallyReconciled===false&&x.applied===false));
 // An equal batch total cannot mask a cash mismatch either.
 rows.gruk_ledger_movimientos.forEach((entry,i)=>{entry.montoCop=totals[i];});
 [rows.gruk_offline_caja_intenciones[0].montoCop,rows.gruk_offline_caja_intenciones[1].montoCop]=
  [rows.gruk_offline_caja_intenciones[1].montoCop,rows.gruk_offline_caja_intenciones[0].montoCop];
 const swappedCash=await read({db,context,eventIds:ids});
 assert(swappedCash.every(x=>x.staged===false&&x.applied===false));
});
