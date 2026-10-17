"use strict";
// This service only FINALIZES an already committed domain operation.
// It never creates sales, payments, invoices or inventory adjustments.
const { STATES, assertTransition } = require("./offlineState.contract");
const SAFE_ID = /^[A-Za-z0-9_-]{1,80}$/;
async function markOfflineApplied({db,context,eventId,reviewToken,commitReference}) {
  if (!db?.collection || !context ||
      ![context.empresaId, context.sedeId, context.actorId].every(id => typeof id === "string" && SAFE_ID.test(id)) ||
      context.canReview !== true ||
      typeof eventId !== "string" || !SAFE_ID.test(eventId) ||
      typeof reviewToken !== "string" || !/^[0-9a-f-]{36}$/.test(reviewToken)) {
    throw new Error("OFFLINE_AUTH_REQUIRED");
  }
  // A caller-supplied boolean is NOT proof of a committed transaction.
  // Actual commitment must be checked against an authoritative domain journal.
  if (!commitReference || typeof commitReference !== "object" ||
      typeof commitReference.collection !== "string" ||
      commitReference.collection !== "gruk_ledger_movimientos" ||
      typeof commitReference.eventId !== "string" ||
      commitReference.eventId !== eventId) throw new Error("OFFLINE_COMMIT_PROOF_REQUIRED");
  const inbox = db.collection("gruk_offline_inbox");
  const key = { empresaId: context.empresaId, sedeId: context.sedeId, eventId,
    status: STATES.EN_REVISION, reviewToken };
  const record = await inbox.findOne(key);
  if (!record) return {status:"NO_RECLAMADO"};
  const ledger = db.collection("gruk_ledger_movimientos");
  const committed = await ledger.findOne({
    empresaId: record.empresaId, sedeId: record.sedeId, eventId,
    actorId: record.actorId, deletedAt: null
  }, { projection: {_id:1,eventId:1,actorId:1} });
  assertTransition({from:record.status,to:STATES.APLICADO,
    verifiedTenant:context,recordTenant:record,authorized:true,domainCommitted:!!committed});
  const update = await inbox.updateOne(key, {$set: {
    status: STATES.APLICADO, appliedAt:new Date(), appliedBy:context.actorId,
    domainCommitEventId:eventId
  }});
  return { status:update.modifiedCount === 1 ? "APLICADO" : "CONFLICTO_CONCURRENCIA" };
}
module.exports = {markOfflineApplied};
