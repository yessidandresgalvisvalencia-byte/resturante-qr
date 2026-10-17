"use strict";
// Review claim with finite lease. Expiration means "investigate", NOT "safe to replay payment".
const { randomUUID } = require("node:crypto");
const { assertTransition, STATES } = require("./offlineState.contract");
const LEASE_MS=60_000;
async function beginReview({db, context, eventId, now=new Date()}) {
  if (!db?.collection || !context?.empresaId || !context?.sedeId || !context?.actorId || !eventId || context.canReview !== true) throw new Error("OFFLINE_AUTH_REQUIRED");
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new Error("OFFLINE_INVALID_TIME");
  const coll=db.collection("gruk_offline_inbox");
  const key={empresaId:context.empresaId,sedeId:context.sedeId,eventId,actorId:context.actorId,status:STATES.PENDIENTE};
  const existing=await coll.findOne(key);
  if (!existing) return {status:"NO_PENDIENTE"};
  assertTransition({from:existing.status,to:STATES.EN_REVISION,verifiedTenant:context,recordTenant:existing,authorized:true});
  const reviewToken=randomUUID();
  const updated=await coll.updateOne(key,{$set:{status:STATES.EN_REVISION,reviewStartedAt:now,reviewLeaseUntil:new Date(now.getTime()+LEASE_MS),reviewToken,reviewActorId:context.actorId}});
  return updated.modifiedCount===1?{status:"EN_REVISION",reviewToken}:{status:"CONFLICTO_CONCURRENCIA"};
}
// Do not reset an expired review automatically: a crashed worker may already
// have committed a domain transaction. Escalate for reconciliation instead.
async function findExpiredReviews({db,context,now=new Date(),limit=50}) {
  if (!db?.collection || !context?.empresaId || !context?.sedeId || context.canReview !== true) throw new Error("OFFLINE_AUTH_REQUIRED");
  if (!(now instanceof Date) || !Number.isFinite(now.getTime()) || !Number.isInteger(limit) || limit<1 || limit>100) throw new Error("OFFLINE_INVALID_QUERY");
  return db.collection("gruk_offline_inbox").find({
    empresaId:context.empresaId,sedeId:context.sedeId,reviewActorId:context.actorId,status:STATES.EN_REVISION,
    reviewLeaseUntil:{$lte:now}
  },{projection:{_id:0,eventId:1,reviewLeaseUntil:1}}).limit(limit).toArray();
}
module.exports={beginReview,findExpiredReviews};
