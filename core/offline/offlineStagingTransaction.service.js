"use strict";
// Internal opt-in entrypoint only. Uses Mongo withTransaction for ALL four
// staging writes. No public route, payment collection, stock mutation or APPLIED flag.
const {executeOfflinePostingTransaction}=require("./offlinePostingTransaction.service");
const {stageOfflineFinancialBatch}=require("./offlineFinancialStaging.service");
async function executeOfflineStagingTransaction({db,context,eventIds,objectId}){
 return executeOfflinePostingTransaction({
  db,context,eventIds,objectId,
  postDomainOperations:({plan,inventoryDeltas,ledgerMovements,session,context:verifiedContext})=>
   stageOfflineFinancialBatch({db,session,context:verifiedContext,plan,inventoryDeltas,ledgerMovements})
 });
}
module.exports={executeOfflineStagingTransaction};
