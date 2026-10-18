"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {readOfflineReconciliation}=require("../../core/offline/offlineReconciliation.service");
const {readOfflineOrderCandidates}=require("../../core/offline/offlinePostingCandidates.service");
const ID="01ARZ3NDEKTSV4RRFFQ69G5FA0";
const a={empresaId:"empresa-A",sedeId:"sede-A",actorId:"user-A"};
const b={empresaId:"empresa-B",sedeId:"sede-B",actorId:"user-B"};
const names=new Set(["gruk_offline_inbox","gruk_offline_ventas","gruk_offline_caja_intenciones","gruk_ledger_movimientos"]);
function mockDb(records={}){
 const probes=[];
 return {probes,db:{collection(name){
   assert.ok(names.has(name),"unexpected read collection "+name);
   return {find(query,options){
     probes.push({name,query,options});
     assert.equal(typeof query.empresaId,"string","missing empresaId");
     assert.equal(typeof query.sedeId,"string","missing sedeId");
     assert.ok(query.eventId&&Array.isArray(query.eventId.$in),"unbounded eventId");
     assert.deepEqual(query.eventId.$in,[ID]);
     return {async toArray(){return (records[name]||[]).filter(row=>
       row.empresaId===query.empresaId&&row.sedeId===query.sedeId&&
       query.eventId.$in.includes(row.eventId)&&
       (query.actorId===undefined||row.actorId===query.actorId)&&
       (query.tipo===undefined||row.tipo===query.tipo)&&
       (query.status===undefined||row.status===query.status)
     );}};
   }};
 }}};
}
test("Capa 2: reconciliation queries all four journals with company and site",async()=>{
 const {db,probes}=mockDb();
 const result=await readOfflineReconciliation({db,context:a,eventIds:[ID]});
 assert.equal(result[0].status,"NO_ENCONTRADO");
 assert.equal(result[0].applied,false);
 assert.equal(probes.length,4);
 for(const probe of probes){
   assert.equal(probe.query.empresaId,a.empresaId);
   assert.equal(probe.query.sedeId,a.sedeId);
   assert.equal(probe.options.projection.actorId,1);
 }
 assert.equal(probes.find(p=>p.name==="gruk_offline_inbox").query.actorId,a.actorId);
});
test("Capa 2: B cannot read A's sales/cash/ledger evidence via same event ULID",async()=>{
 const records={
  gruk_offline_inbox:[{...a,eventId:ID,status:"APLICADO",inventoryApplied:true}],
  gruk_offline_ventas:[{...a,eventId:ID,status:"CONTABILIZADA",totalCop:"5000"}],
  gruk_offline_caja_intenciones:[{...a,eventId:ID,status:"CONCILIADO",cobrado:true,montoCop:"5000"}],
  gruk_ledger_movimientos:[{...a,eventId:ID,tipo:"VENTA_OFFLINE",montoCop:"5000",deletedAt:null}]
 };
 const {db,probes}=mockDb(records);
 const read=await readOfflineReconciliation({db,context:b,eventIds:[ID]});
 assert.deepEqual(read,[{eventId:ID,status:"NO_ENCONTRADO",applied:false,staged:false,financiallyReconciled:false}]);
 assert.equal(probes.length,4);
 assert.ok(probes.every(p=>p.query.empresaId===b.empresaId&&p.query.sedeId===b.sedeId));
});
test("Capa 2: forgery from other actor never becomes reconciled",async()=>{
 const records={
  gruk_offline_inbox:[{...a,eventId:ID,status:"APLICADO",inventoryApplied:true}],
  gruk_offline_ventas:[{...a,actorId:"other",eventId:ID,status:"CONTABILIZADA",totalCop:"5000"}],
  gruk_offline_caja_intenciones:[{...a,eventId:ID,status:"CONCILIADO",cobrado:true,montoCop:"5000"}],
  gruk_ledger_movimientos:[{...a,eventId:ID,tipo:"VENTA_OFFLINE",montoCop:"5000",deletedAt:null}]
 };
 const {db}=mockDb(records);
 const [result]=await readOfflineReconciliation({db,context:a,eventIds:[ID]});
 assert.equal(result.staged,false);
 assert.equal(result.financiallyReconciled,false);
 assert.equal(result.applied,false);
});
test("Capa 2: missing company/site/actor aborts before any collection read",async()=>{
 const db={collection(){throw Error("UNAUTHORIZED_DB_ACCESS");}};
 for(const context of [null,{}, {sedeId:a.sedeId,actorId:a.actorId},
  {empresaId:a.empresaId,actorId:a.actorId},
  {empresaId:a.empresaId,sedeId:a.sedeId}]){
  await assert.rejects(readOfflineReconciliation({db,context,eventIds:[ID]}),{code:"OFFLINE_AUTH_REQUIRED"});
  await assert.rejects(readOfflineOrderCandidates({db,context,eventIds:[ID]}),{code:"OFFLINE_AUTH_REQUIRED"});
 }
});
test("Capa 2: pending order reader requires actor plus tenant scope",async()=>{
 const {db,probes}=mockDb();
 await assert.rejects(readOfflineOrderCandidates({db,context:a,eventIds:[ID]}),{code:"OFFLINE_ORDERS_NOT_PENDING"});
 assert.equal(probes.length,1);
 assert.deepEqual(probes[0].query,{
  empresaId:a.empresaId,sedeId:a.sedeId,actorId:a.actorId,
  tipo:"PEDIDO_REGISTRADO",status:"PENDIENTE",eventId:{$in:[ID]}
 });
});
