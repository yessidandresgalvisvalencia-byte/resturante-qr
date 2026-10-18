"use strict";
// Idempotent READ-ONLY recovery for an already staged offline batch.
// Never retries stock writes; rejects partial or mismatched evidence.
const {readOfflineReconciliation}=require("./offlineReconciliation.service");
function validRecord(row,context){
 return row&&row.empresaId===context.empresaId&&
  row.sedeId===context.sedeId&&row.actorId===context.actorId;
}
function fail(){const e=new Error("OFFLINE_STAGE_REPLAY_REQUIRES_REVIEW");e.code=e.message;throw e;}
async function recoverOfflineStagedBatch({db,context,eventIds}){
 if(!db?.collection||!context||!Array.isArray(eventIds)||!eventIds.length)fail();
 const statuses=await readOfflineReconciliation({db,context,eventIds});
 if(statuses.length!==eventIds.length||statuses.some(r=>
   r.status!=="EN_REVISION"||r.staged!==true||r.applied!==false||
   r.financiallyReconciled!==false))fail();
 const scope={empresaId:context.empresaId,sedeId:context.sedeId,actorId:context.actorId,
   eventId:{$in:eventIds}};
 const inbox=await db.collection("gruk_offline_inbox").find(scope,{
  projection:{_id:0,empresaId:1,sedeId:1,actorId:1,eventId:1,status:1,financialStageStatus:1,inventoryApplied:1,stagedBy:1}
 }).toArray();
 if(inbox.length!==eventIds.length||new Set(inbox.map(x=>x.eventId)).size!==eventIds.length||
   inbox.some(x=>!validRecord(x,context)||!eventIds.includes(x.eventId)||x.status!=="EN_REVISION"||x.financialStageStatus!=="PENDIENTE_CONTABILIZACION"||
     x.inventoryApplied!==true||x.stagedBy!==context.actorId))fail();
 const sales=await db.collection("gruk_offline_ventas").find(scope,{
  projection:{_id:0,empresaId:1,sedeId:1,actorId:1,eventId:1,status:1,totalCop:1}
 }).toArray();
 if(sales.length!==eventIds.length||new Set(sales.map(x=>x.eventId)).size!==eventIds.length)fail();
 let total=0n;
 for(const sale of sales){
  if(!validRecord(sale,context)||!eventIds.includes(sale.eventId)||sale.status!=="PENDIENTE_CONTABILIZACION"||
    typeof sale.totalCop!=="string"||!/^(0|[1-9][0-9]*)$/.test(sale.totalCop))fail();
  total+=BigInt(sale.totalCop);
 }
 const cash=await db.collection("gruk_offline_caja_intenciones").find(scope,{
  projection:{_id:0,empresaId:1,sedeId:1,actorId:1,eventId:1,status:1,cobrado:1,montoCop:1}
 }).toArray();
 if(cash.length!==eventIds.length||new Set(cash.map(x=>x.eventId)).size!==eventIds.length||
   cash.some(x=>!validRecord(x,context)||!eventIds.includes(x.eventId)||x.status!=="PENDIENTE_CONCILIACION"||
     x.cobrado!==false||typeof x.montoCop!=="string"||
     !/^(0|[1-9][0-9]*)$/.test(x.montoCop)))fail();
 const bySale=new Map(sales.map(x=>[x.eventId,x.totalCop]));
 if(cash.some(x=>bySale.get(x.eventId)!==x.montoCop))fail();
 if(total>BigInt(Number.MAX_SAFE_INTEGER))fail();
 return Object.freeze({status:"PENDIENTE_CONTABILIZACION",alreadyStaged:true,
  applied:false,cobrado:false,processedEvents:eventIds.length,totalCop:total.toString()});
}
module.exports={recoverOfflineStagedBatch};
