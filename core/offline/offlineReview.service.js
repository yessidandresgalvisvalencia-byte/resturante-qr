"use strict";
// Atomic inbox transition. This does not apply domain effects, and must not be used as payment confirmation.
const { assertTransition, STATES } = require("./offlineState.contract");
async function beginReview({db, context, eventId}) {
  if (!db?.collection || !context?.empresaId || !context?.sedeId || !context?.actorId || !eventId) throw new Error("OFFLINE_AUTH_REQUIRED");
  const coll=db.collection("gruk_offline_inbox");
  const key={empresaId:context.empresaId,sedeId:context.sedeId,eventId,status:STATES.PENDIENTE};
  const existing=await coll.findOne(key);
  if (!existing) return {status:"NO_PENDIENTE"};
  assertTransition({from:existing.status,to:STATES.EN_REVISION,verifiedTenant:context,recordTenant:existing,authorized:context.canReview===true});
  const updated=await coll.updateOne(key,{$set:{status:STATES.EN_REVISION,reviewStartedAt:new Date(),reviewActorId:context.actorId}});
  return {status:updated.modifiedCount===1?"EN_REVISION":"CONFLICTO_CONCURRENCIA"};
}
module.exports={beginReview};
