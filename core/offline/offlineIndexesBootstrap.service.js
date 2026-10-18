"use strict";
// Explicit migration. Invoke only after a separate operational review of duplicates.
// Does not change existing documents or mark offline operations applied.
const {ensureOfflineSalesIndexes}=require("./offlineSalesIndexes.service");
const {ensureOfflineStockIndexes}=require("./offlineStockIndexes.service");
const {ensureOfflineCashIndexes}=require("./offlineCashIndexes.service");
const {ensureOfflineLedgerIndexes}=require("./offlineLedgerIndexes.service");
const {assertOfflineStagingIndexes}=require("./offlineIndexesReadiness.service");
async function bootstrapOfflineStagingIndexes(db){
 if(typeof db?.collection!=="function")throw new TypeError("OFFLINE_DATABASE_REQUIRED");
 await ensureOfflineSalesIndexes(db);
 await ensureOfflineStockIndexes(db);
 await ensureOfflineCashIndexes(db);
 await ensureOfflineLedgerIndexes(db);
 return assertOfflineStagingIndexes(db);
}
module.exports={bootstrapOfflineStagingIndexes};
