"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {readOfflineReconciliation:read}=require("../../core/offline/offlineReconciliation.service");
const context=Object.freeze({empresaId:"empresaA",sedeId:"sedeA",actorId:"operadorA"});
const eventId="01ARZ3NDEKTSV4RRFFQ69G5FA0";
const collectionNames=["gruk_offline_inbox","gruk_offline_ventas","gruk_offline_caja_intenciones","gruk_ledger_movimientos"];
function fixture(rowsByName){
 const queries=[];
 const db={collection(name){
  assert.ok(collectionNames.includes(name),"No unexpected collections");
  return {find(filter,options){
   queries.push({name,filter,options});
   return {toArray:async()=>rowsByName[name]||[]};
  }};
 }};
 return {db,queries};
}
function row(extra){return {empresaId:context.empresaId,sedeId:context.sedeId,actorId:context.actorId,eventId,...extra};}
const evidence={
 gruk_offline_inbox:[row({status:"APLICADO",inventoryApplied:true})],
 gruk_offline_ventas:[row({status:"CONTABILIZADA",totalCop:"3000"})],
 gruk_offline_caja_intenciones:[row({status:"CONCILIADO",montoCop:"3000",cobrado:true})],
 gruk_ledger_movimientos:[row({tipo:"VENTA_OFFLINE",montoCop:"3000",deletedAt:null})]
};
test("Capa 2 ofensiva: todas las consultas de conciliación exigen empresa y sede autenticadas",async()=>{
 const f=fixture(evidence);
 const [result]=await read({db:f.db,context,eventIds:[eventId]});
 assert.equal(result.applied,true);
 assert.equal(f.queries.length,4);
 for(const {name,filter,options} of f.queries){
  assert.equal(filter.empresaId,context.empresaId);
  assert.equal(filter.sedeId,context.sedeId);
  assert.deepEqual(filter.eventId,{$in:[eventId]});
  if(name==="gruk_offline_inbox")assert.equal(filter.actorId,context.actorId);
  assert.equal(options.projection.empresaId,1);
  assert.equal(options.projection.sedeId,1);
  assert.equal(options.projection.actorId,1);
 }
});
test("Capa 2 ofensiva: inbox de otra empresa o sede jamás revela evento ni su estado",async()=>{
 for(const foreign of [{empresaId:"empresaB"},{sedeId:"sedeB"},{actorId:"operadorB"}]){
  const data={...evidence,gruk_offline_inbox:[row({status:"APLICADO",inventoryApplied:true,...foreign})]};
  const f=fixture(data);
  const [result]=await read({db:f.db,context,eventIds:[eventId]});
  assert.deepEqual(result,{eventId,status:"NO_ENCONTRADO",applied:false,staged:false,financiallyReconciled:false});
 }
});
test("Capa 2 ofensiva: evidencia ajena de venta, caja o ledger no acredita conciliación",async()=>{
 for(const target of ["gruk_offline_ventas","gruk_offline_caja_intenciones","gruk_ledger_movimientos"]){
  for(const foreign of [{empresaId:"empresaB"},{sedeId:"sedeB"},{actorId:"operadorB"}]){
   const data={...evidence,[target]:evidence[target].map(item=>({...item,...foreign}))};
   const [result]=await read({db:fixture(data).db,context,eventIds:[eventId]});
   assert.equal(result.staged,false,target);
   assert.equal(result.financiallyReconciled,false,target);
   assert.equal(result.applied,false,target);
  }
 }
});
test("Capa 2 ofensiva: mezcla de evidencia legítima y ajena para mismo ID no acredita venta",async()=>{
 for(const target of collectionNames){
  const data={...evidence,[target]:[...evidence[target],{...evidence[target][0],empresaId:"empresaB"}]};
  const [result]=await read({db:fixture(data).db,context,eventIds:[eventId]});
  assert.equal(result.applied,false,target);
  if(target==="gruk_offline_inbox")assert.equal(result.status,"NO_ENCONTRADO");
  else assert.equal(result.staged,false,target);
 }
});
test("Capa 2 ofensiva: sin contexto autenticado no se consulta ningún dato",async()=>{
 for(const key of ["empresaId","sedeId","actorId"]){
  let collectionReads=0;
  const db={collection(){collectionReads++;throw Error("UNAUTHORIZED_QUERY");}};
  await assert.rejects(read({db,context:{...context,[key]:undefined},eventIds:[eventId]}),{code:"OFFLINE_AUTH_REQUIRED"});
  assert.equal(collectionReads,0);
 }
});
