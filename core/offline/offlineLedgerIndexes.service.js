"use strict";
// Run as part of offline infrastructure bootstrap, before enabling ledger writes.
async function ensureOfflineLedgerIndexes(db) {
 if (!db || typeof db.collection !== "function") throw new TypeError("OFFLINE_DATABASE_REQUIRED");
 const ledger=db.collection("gruk_ledger_movimientos");
 await ledger.createIndex(
  {empresaId:1,sedeId:1,eventId:1,tipo:1},
  {unique:true,name:"uniq_offline_ledger_event_type_tenant"}
 );
 return true;
}
module.exports={ensureOfflineLedgerIndexes};
