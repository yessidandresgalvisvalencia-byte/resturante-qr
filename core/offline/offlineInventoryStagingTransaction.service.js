"use strict";
// Internal-only: stage all four financial journals and decrement mapped inventory
// in one Mongo transaction. This does NOT settle cash or mark inbox APPLIED.
const {executeOfflinePostingTransaction}=require("./offlinePostingTransaction.service");
const {stageOfflineFinancialBatch}=require("./offlineFinancialStaging.service");
const {applyOfflineLegacyInventory}=require("./offlineLegacyInventoryWriter.service");
const {assertOfflineStagingIndexes}=require("./offlineIndexesReadiness.service");
async function executeOfflineInventoryStagingTransaction({db,context,eventIds,objectId}){
 await assertOfflineStagingIndexes(db);
 return executeOfflinePostingTransaction({db,context,eventIds,objectId,
  postDomainOperations:async({plan,inventoryDeltas,ledgerMovements,session,context:verifiedContext})=>{
   const staged=await stageOfflineFinancialBatch({
    db,session,context:verifiedContext,plan,inventoryDeltas,ledgerMovements
   });
   const inventory=await applyOfflineLegacyInventory({
    db,session,context:verifiedContext,inventoryDeltas,objectId
   });
   return Object.freeze({...staged,inventory,inventoryApplied:true});
  }
 });
}
module.exports={executeOfflineInventoryStagingTransaction};
