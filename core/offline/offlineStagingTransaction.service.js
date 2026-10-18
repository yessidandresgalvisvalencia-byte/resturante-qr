"use strict";
// Internal opt-in entrypoint only. No public route, cash settlement, inventory update or APPLIED.
const {executeOfflinePostingTransaction}=require("./offlinePostingTransaction.service");
const {stageOfflineFinancialBatch}=require("./offlineFinancialStaging.service");
const {assertOfflineStagingIndexes}=require("./offlineIndexesReadiness.service");
async function executeOfflineStagingTransaction({db,context,eventIds,objectId}){
 // Fail closed BEFORE creating any transaction or staging documents.
 await assertOfflineStagingIndexes(db);
 return executeOfflinePostingTransaction({
  db,context,eventIds,objectId,
  postDomainOperations:({plan,inventoryDeltas,ledgerMovements,session,context:verifiedContext})=>
   stageOfflineFinancialBatch({db,session,context:verifiedContext,plan,inventoryDeltas,ledgerMovements})
 });
}
module.exports={executeOfflineStagingTransaction};
