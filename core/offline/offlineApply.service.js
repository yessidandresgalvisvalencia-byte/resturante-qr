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
  if(typeof db?.client?.startSession!=="function")throw new Error("OFFLINE_TRANSACTION_UNAVAILABLE");
  const session=db.client.startSession();
  try {
    if(typeof session?.withTransaction!=="function")throw new Error("OFFLINE_TRANSACTION_UNAVAILABLE");
    let outcome;
    await session.withTransaction(async()=>{
  const inbox = db.collection("gruk_offline_inbox");
  const key = { empresaId: context.empresaId, sedeId: context.sedeId, eventId,
    status: STATES.EN_REVISION, reviewToken, actorId: context.actorId,
    reviewActorId: context.actorId };
  const record = await inbox.findOne(key,{session});
  if (!record){outcome={status:"NO_RECLAMADO"};return;}
  // A staging ledger entry alone does not prove a settled sale or paid cash.
  // All three authoritative records must be consistent and final.
  const ledger = await db.collection("gruk_ledger_movimientos").findOne({
    empresaId:record.empresaId,sedeId:record.sedeId,eventId,
    actorId:record.actorId,tipo:"VENTA_OFFLINE",deletedAt:{$type:10}
  },{session,projection:{_id:1,montoCop:1}});
  const scope={empresaId:record.empresaId,sedeId:record.sedeId,eventId,actorId:record.actorId};
  const sale=await db.collection("gruk_offline_ventas").findOne({
    ...scope,status:"CONTABILIZADA"
  },{session,projection:{totalCop:1}});
  const cash=await db.collection("gruk_offline_caja_intenciones").findOne({
    ...scope,status:"CONCILIADO",cobrado:true
  },{session,projection:{montoCop:1}});
  // Every journal must contain exactly one proof for the tenant/site/event,
  // including entries with unexpected actors or ledger movement types.
  // findOne alone could select a valid document while ignoring a duplicate.
  const eventScope={empresaId:record.empresaId,sedeId:record.sedeId,eventId};
  const [saleProofs,cashProofs,ledgerProofs]=await Promise.all([
    db.collection("gruk_offline_ventas").countDocuments(eventScope,{session}),
    db.collection("gruk_offline_caja_intenciones").countDocuments(eventScope,{session}),
    db.collection("gruk_ledger_movimientos").countDocuments(eventScope,{session})
  ]);
  const uniqueProofs=saleProofs===1&&cashProofs===1&&ledgerProofs===1;
  const integerCop=value=>typeof value==="string"&&/^(0|[1-9][0-9]*)$/.test(value);
  const committed=!!(record.inventoryApplied===true&&uniqueProofs&&ledger&&sale&&cash&&integerCop(ledger.montoCop)&&
    integerCop(sale.totalCop)&&integerCop(cash.montoCop)&&
    ledger.montoCop===sale.totalCop&&sale.totalCop===cash.montoCop);
  assertTransition({from:record.status,to:STATES.APLICADO,
    verifiedTenant:context,recordTenant:record,authorized:true,domainCommitted:!!committed});
  const update = await inbox.updateOne(key, {$set: {
    status: STATES.APLICADO, appliedAt:new Date(), appliedBy:context.actorId,
    domainCommitEventId:eventId
  }},{session});
  outcome={status:update.modifiedCount === 1 ? "APLICADO" : "CONFLICTO_CONCURRENCIA"};
    },{readConcern:{level:"snapshot"},writeConcern:{w:"majority"}});
    return outcome;
  } finally {if(typeof session?.endSession==="function")await session.endSession();}
}
module.exports = {markOfflineApplied};
