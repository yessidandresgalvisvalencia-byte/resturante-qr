"use strict";
// Commit review-state handoff in the SAME transaction as journals and inventory.
const {randomUUID}=require("node:crypto");
const {STATES,assertTransition}=require("./offlineState.contract");
const ID=/^[A-Za-z0-9_-]{1,80}$/;
const ULID=/^[0-9A-HJKMNP-TV-Z]{26}$/;
const LEASE_MS=60_000;
function fail(){const e=new Error("OFFLINE_STAGE_INBOX_CONFLICT");e.code=e.message;throw e;}
async function markOfflineStagedInTransaction({db,session,context,plan,now=new Date()}){
 if(!db?.collection||session?.inTransaction?.()!==true||
   !context||![context.empresaId,context.sedeId,context.actorId].every(id=>typeof id==="string"&&ID.test(id))||
   !Array.isArray(plan?.orders)||!plan.orders.length||plan.orders.length>100||
   !(now instanceof Date)||!Number.isFinite(now.getTime()))fail();
 const ids=plan.orders.map(order=>order?.eventId);
 if(ids.some(id=>typeof id!=="string"||!ULID.test(id))||new Set(ids).size!==ids.length)fail();
 const inbox=db.collection("gruk_offline_inbox");
 const handoffs=[];
 for(const eventId of ids){
  const key={empresaId:context.empresaId,sedeId:context.sedeId,actorId:context.actorId,
   eventId,tipo:"PEDIDO_REGISTRADO",status:STATES.PENDIENTE};
  const record=await inbox.findOne(key,{session,projection:{empresaId:1,sedeId:1,actorId:1,eventId:1,tipo:1,status:1}});
  if(!record||record.empresaId!==context.empresaId||record.sedeId!==context.sedeId||
    record.actorId!==context.actorId||record.eventId!==eventId||
    record.tipo!=="PEDIDO_REGISTRADO"||record.status!==STATES.PENDIENTE)fail();
  assertTransition({from:record.status,to:STATES.EN_REVISION,
   verifiedTenant:context,recordTenant:record,authorized:true});
  const token=randomUUID();
  const updated=await inbox.updateOne(key,{$set:{
   status:STATES.EN_REVISION,financialStageStatus:"PENDIENTE_CONTABILIZACION",
   inventoryApplied:true,stagedAt:now,stagedBy:context.actorId,
   reviewStartedAt:now,reviewLeaseUntil:new Date(now.getTime()+LEASE_MS),
   reviewToken:token,reviewActorId:context.actorId
  }},{session});
  if(updated?.matchedCount!==1||updated?.modifiedCount!==1)fail();
  handoffs.push(Object.freeze({eventId,status:STATES.EN_REVISION}));
 }
 return Object.freeze(handoffs);
}
module.exports={markOfflineStagedInTransaction};
