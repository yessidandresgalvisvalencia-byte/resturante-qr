"use strict";
// Idempotent READ-ONLY recovery for an already staged offline batch.
// Never retries stock writes; rejects partial or mismatched evidence.
const {readOfflineReconciliation}=require("./offlineReconciliation.service");
function validRecord(row,context){
 return row&&row.empresaId===context.empresaId&&
  row.sedeId===context.sedeId&&row.actorId===context.actorId;
}
function fail(){const e=new Error("OFFLINE_STAGE_REPLAY_REQUIRES_REVIEW");e.code=e.message;throw e;}
function completeRecords(rows,count){
 return Array.isArray(rows)&&rows.length===count&&
  Array.from({length:count},(_,i)=>Object.hasOwn(rows,i)).every(Boolean);
}
async function recoverOfflineStagedBatch({db,context,eventIds}){
 // Snapshot the authenticated scope and identifiers BEFORE async reconciliation.
 // Never trust a mutable caller object after the first database read.
 const identity={};
 const idPattern=/^[A-Za-z0-9_-]{1,80}$/;
 if(!context||typeof context!=="object"||Array.isArray(context))fail();
 for(const field of ["empresaId","sedeId","actorId"]){
  const d=Object.getOwnPropertyDescriptor(context,field);
  if(!d||!("value" in d)||typeof d.value!=="string"||!idPattern.test(d.value))fail();
  identity[field]=d.value;
 }
 if(!Array.isArray(eventIds)||eventIds.length<1||eventIds.length>100)fail();
 const ids=[];
 for(let i=0;i<eventIds.length;i++){
  const d=Object.getOwnPropertyDescriptor(eventIds,String(i));
  if(!d||!("value" in d)||typeof d.value!=="string"||
   !/^[0-9A-HJKMNP-TV-Z]{26}$/.test(d.value))fail();
  ids.push(d.value);
 }
 if(new Set(ids).size!==ids.length)fail();
 if(!db||typeof db.collection!=="function")fail();
 const scopedContext=Object.freeze(identity),scopedIds=Object.freeze(ids);
 const statuses=await readOfflineReconciliation({db,context:scopedContext,eventIds:scopedIds});
 if(!Array.isArray(statuses)||statuses.length!==scopedIds.length||
    statuses.some(r=>r.status!=="EN_REVISION"||r.staged!==true||
     r.applied!==false||r.financiallyReconciled!==false))fail();
 const scope={empresaId:scopedContext.empresaId,sedeId:scopedContext.sedeId,
  actorId:scopedContext.actorId,eventId:{$in:scopedIds}};
 const inbox=await db.collection("gruk_offline_inbox").find(scope,{
  projection:{_id:0,empresaId:1,sedeId:1,actorId:1,eventId:1,status:1,financialStageStatus:1,inventoryApplied:1,stagedBy:1}
 }).toArray();
 if(!completeRecords(inbox,scopedIds.length)||new Set(inbox.map(x=>x.eventId)).size!==scopedIds.length||
   inbox.some(x=>!validRecord(x,scopedContext)||!scopedIds.includes(x.eventId)||x.status!=="EN_REVISION"||x.financialStageStatus!=="PENDIENTE_CONTABILIZACION"||
     x.inventoryApplied!==true||x.stagedBy!==scopedContext.actorId))fail();
 const sales=await db.collection("gruk_offline_ventas").find(scope,{
  projection:{_id:0,empresaId:1,sedeId:1,actorId:1,eventId:1,status:1,totalCop:1}
 }).toArray();
 if(!completeRecords(sales,scopedIds.length)||new Set(sales.map(x=>x.eventId)).size!==scopedIds.length)fail();
 let total=0n;
 for(const sale of sales){
  if(!validRecord(sale,scopedContext)||!scopedIds.includes(sale.eventId)||sale.status!=="PENDIENTE_CONTABILIZACION"||
    typeof sale.totalCop!=="string"||!/^(0|[1-9][0-9]*)$/.test(sale.totalCop)||
    BigInt(sale.totalCop)>BigInt(Number.MAX_SAFE_INTEGER))fail();
  total+=BigInt(sale.totalCop);
 }
 const cash=await db.collection("gruk_offline_caja_intenciones").find(scope,{
  projection:{_id:0,empresaId:1,sedeId:1,actorId:1,eventId:1,status:1,cobrado:1,montoCop:1}
 }).toArray();
 if(!completeRecords(cash,scopedIds.length)||new Set(cash.map(x=>x.eventId)).size!==scopedIds.length||
   cash.some(x=>!validRecord(x,scopedContext)||!scopedIds.includes(x.eventId)||x.status!=="PENDIENTE_CONCILIACION"||
     x.cobrado!==false||typeof x.montoCop!=="string"||
     !/^(0|[1-9][0-9]*)$/.test(x.montoCop)||
     BigInt(x.montoCop)>BigInt(Number.MAX_SAFE_INTEGER)))fail();
 const bySale=new Map(sales.map(x=>[x.eventId,x.totalCop]));
 if(cash.some(x=>bySale.get(x.eventId)!==x.montoCop))fail();
 if(total>BigInt(Number.MAX_SAFE_INTEGER))fail();
 return Object.freeze({status:"PENDIENTE_CONTABILIZACION",alreadyStaged:true,
  applied:false,cobrado:false,processedEvents:scopedIds.length,totalCop:total.toString()});
}
module.exports={recoverOfflineStagedBatch};
