"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {readOfflineReconciliation:read}=require("../../core/offline/offlineReconciliation.service");
const id="01ARZ3NDEKTSV4RRFFQ69G5FA0",other="01ARZ3NDEKTSV4RRFFQ69G5FA1";
const ctx={empresaId:"empresaA",sedeId:"sedeA",actorId:"operadorA"};
function fixture({inboxStatus="PENDIENTE",inventoryApplied=false,saleStatus="PENDIENTE_CONTABILIZACION",cashStatus="PENDIENTE_CONCILIACION",paid=false,cashAmount="3000",ledgerAmount="3000",saleAmount="3000",otherTenant=false,duplicate=false,foreignActorProof=false}={}){
 let count=0;
 const s={...ctx,eventId:id};
 const tenant=otherTenant?{...s,empresaId:"empresaB"}:s;
 const data={
  gruk_offline_inbox:[{...tenant,status:inboxStatus,inventoryApplied}],
  gruk_offline_ventas:[{...tenant,status:saleStatus,totalCop:saleAmount}],
  gruk_offline_caja_intenciones:[{...tenant,status:cashStatus,cobrado:paid,montoCop:cashAmount}],
  gruk_ledger_movimientos:[{...tenant,tipo:"VENTA_OFFLINE",montoCop:ledgerAmount,deletedAt:null}]
 };
 if(duplicate)data.gruk_offline_ventas.push({...data.gruk_offline_ventas[0]});
 if(foreignActorProof)data.gruk_ledger_movimientos.push({...data.gruk_ledger_movimientos[0],actorId:"operadorB"});
 return {collection(name){
  count++;
  assert.ok(Object.hasOwn(data,name));
  return {find(query){
   assert.deepEqual(query,{empresaId:ctx.empresaId,sedeId:ctx.sedeId,...(name==="gruk_offline_inbox"?{actorId:ctx.actorId}:{}),eventId:{$in:[id,other]}});
   return {async toArray(){return data[name].filter(v=>v.empresaId===query.empresaId&&v.sedeId===query.sedeId&&(!query.actorId||v.actorId===query.actorId)&&query.eventId.$in.includes(v.eventId));}};
  }};
 },get count(){return count;}};
}
test("offline reconciliation: staging is NOT cash payment or applied event",async()=>{
 const f=fixture();
 const result=await read({db:f,context:ctx,eventIds:[id,other]});
 assert.deepEqual(result[0],{eventId:id,status:"PENDIENTE",staged:true,financiallyReconciled:false,applied:false});
 assert.deepEqual(result[1],{eventId:other,status:"NO_ENCONTRADO",applied:false,staged:false,financiallyReconciled:false});
 assert.equal(f.count,4);
});
test("offline reconciliation: final requires paid cash, accounted sale and APPLIED inbox",async()=>{
 const opts={inboxStatus:"APLICADO",inventoryApplied:true,saleStatus:"CONTABILIZADA",cashStatus:"CONCILIADO",paid:true};
 assert.deepEqual((await read({db:fixture(opts),context:ctx,eventIds:[id,other]}))[0],
 {eventId:id,status:"APLICADO",staged:true,financiallyReconciled:true,applied:true});
 const withoutInventory=await read({db:fixture({...opts,inventoryApplied:false}),context:ctx,eventIds:[id,other]});
 assert.equal(withoutInventory[0].applied,false);
 const before=await read({db:fixture({...opts,inboxStatus:"EN_REVISION"}),context:ctx,eventIds:[id,other]});
 assert.equal(before[0].financiallyReconciled,true);
 assert.equal(before[0].applied,false);
});
test("offline reconciliation: broken money, duplicated proofs and cross-tenant evidence fail closed",async()=>{
 for(const options of [{cashAmount:"2999"},{ledgerAmount:"2999"},
  {saleAmount:"9007199254740992",cashAmount:"9007199254740992",ledgerAmount:"9007199254740992"},
  {cashAmount:"1e3"},{ledgerAmount:"-3000"},{duplicate:true},{foreignActorProof:true},{otherTenant:true}]){
  const result=await read({db:fixture({...options,inboxStatus:"APLICADO",inventoryApplied:true,saleStatus:"CONTABILIZADA",cashStatus:"CONCILIADO",paid:true}),context:ctx,eventIds:[id,other]});
  assert.equal(result[0].applied,false);
 }
});
test("offline reconciliation: invalid identity/ids never touches Mongo",async()=>{
 let calls=0;const db={collection(){calls++;throw Error("QUERY_FORBIDDEN");}};
 await assert.rejects(read({db,context:{...ctx,actorId:"$ne"},eventIds:[id]}),/OFFLINE_AUTH_REQUIRED/);
 await assert.rejects(read({db,context:ctx,eventIds:[id,id]}),/OFFLINE_INVALID_IDS/);
 await assert.rejects(read({db,context:ctx,eventIds:["bad"]}),/OFFLINE_INVALID_IDS/);
 assert.equal(calls,0);
});

test("Capa 2: malformed or unsolicited financial proof poisons reconciliation rather than confirming payment",async()=>{
 const base={...ctx,eventId:id};
 const source={
  gruk_offline_inbox:[{...base,status:"APLICADO",inventoryApplied:true}],
  gruk_offline_ventas:[{...base,status:"CONTABILIZADA",totalCop:"3000"}],
  gruk_offline_caja_intenciones:[{...base,status:"CONCILIADO",cobrado:true,montoCop:"3000"}],
  gruk_ledger_movimientos:[{...base,tipo:"VENTA_OFFLINE",montoCop:"3000",deletedAt:null}]
 };
 for(const poison of [null,{}, {empresaId:ctx.empresaId,sedeId:ctx.sedeId,actorId:ctx.actorId},
  {...base,eventId:other,status:"CONTABILIZADA"},
  {...base,eventId:"bad",status:"CONTABILIZADA"}]){
  const db={collection(name){return {find:()=>({
   toArray:async()=>name==="gruk_offline_ventas"?[...source[name],poison]:source[name]
  })};}};
  const result=await read({db,context:ctx,eventIds:[id]});
  assert.equal(result[0].applied,false);
  assert.equal(result[0].financiallyReconciled,false);
  assert.equal(result[0].staged,false);
 }
});
test("Capa 2: malformed reconciliation collection response is rejected",async()=>{
 const db={collection(name){return {find:()=>({toArray:async()=>name==="gruk_offline_ventas"?null:[]})};}};
 await assert.rejects(read({db,context:ctx,eventIds:[id]}),
  {code:"OFFLINE_RECONCILIATION_EVIDENCE_INVALID"});
});
