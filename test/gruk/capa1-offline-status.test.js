"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {readOfflineStatuses}=require("../../core/offline/offlineStatus.service");
const a="01ARZ3NDEKTSV4RRFFQ69G5FAV",b="01ARZ3NDEKTSV4RRFFQ69G5FAW";
const ctx={empresaId:"empresaA",sedeId:"sedeA",actorId:"actorA"};
function fixture({
 status="APLICADO", inventoryApplied=true, paid=true,
 saleAmount="3000",cashAmount="3000",ledgerAmount="3000",
 saleStatus="CONTABILIZADA",cashStatus="CONCILIADO",duplicateLedger=false
}={}){
 const tenant={...ctx,eventId:a};
 const data={
  gruk_offline_inbox:[{...tenant,status,inventoryApplied}],
  gruk_offline_ventas:[{...tenant,status:saleStatus,totalCop:saleAmount}],
  gruk_offline_caja_intenciones:[{...tenant,status:cashStatus,montoCop:cashAmount,cobrado:paid}],
  gruk_ledger_movimientos:[{...tenant,tipo:"VENTA_OFFLINE",montoCop:ledgerAmount,deletedAt:null}]
 };
 if(duplicateLedger)data.gruk_ledger_movimientos.push({...data.gruk_ledger_movimientos[0]});
 let calls=0;
 return {collection(name){
  assert.ok(Object.hasOwn(data,name),"Known reconciliation collection only");
  return {find(query,options){
   calls++;
   assert.equal(query.empresaId,ctx.empresaId);
   assert.equal(query.sedeId,ctx.sedeId);
   assert.equal(query.actorId,ctx.actorId);
   assert.ok(Array.isArray(query.eventId.$in));
   assert.ok(query.eventId.$in.every(eventId=>[a,b].includes(eventId)));
   assert.equal(options.projection._id,0);
   return {toArray:async()=>data[name].filter(doc=>query.eventId.$in.includes(doc.eventId))};
  }};
 },get calls(){return calls;}};
}
test("status requires tenant-scoped financial reconciliation for applied=true",async()=>{
 const db=fixture();
 assert.deepEqual(await readOfflineStatuses({db,context:ctx,eventIds:[a,b]}),[
  {eventId:a,status:"APLICADO",applied:true},
  {eventId:b,status:"NO_ENCONTRADO",applied:false}
 ]);
 assert.equal(db.calls,4);
});
test("APLICADO without evidence never releases tablet reservations",async()=>{
 const invalid=[
  {inventoryApplied:false},{paid:false},{cashAmount:"2999"},
  {ledgerAmount:"2999"},{saleAmount:"2999"},{duplicateLedger:true},
  {saleStatus:"PENDIENTE_CONTABILIZACION"},{cashStatus:"PENDIENTE_CONCILIACION"}
 ];
 for(const opts of invalid){
  const db=fixture(opts);
  assert.deepEqual(await readOfflineStatuses({db,context:ctx,eventIds:[a]}),[
   {eventId:a,status:"APLICADO",applied:false}
  ],JSON.stringify(opts));
 }
 assert.deepEqual(await readOfflineStatuses({db:fixture({status:"EN_REVISION"}),context:ctx,eventIds:[a]}),[
  {eventId:a,status:"EN_REVISION",applied:false}
 ]);
});
test("invalid identity and event IDs are rejected before touching database",async()=>{
 let touched=false;
 const db={collection(){touched=true;throw Error("UNEXPECTED_QUERY")}};
 for(const context of [{...ctx,sedeId:null},null]){
  await assert.rejects(readOfflineStatuses({db,context,eventIds:[a]}),/OFFLINE_AUTH_REQUIRED/);
 }
 for(const eventIds of [[],[a,a],["invalid"],Array(101).fill(a)]){
  await assert.rejects(readOfflineStatuses({db,context:ctx,eventIds}),/OFFLINE_INVALID_IDS/);
 }
 assert.equal(touched,false);
});
