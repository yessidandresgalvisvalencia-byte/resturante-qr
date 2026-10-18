"use strict";
// Internal-only: stage all four financial journals and decrement mapped inventory
// in one Mongo transaction. This does NOT settle cash or mark inbox APPLIED.
const {executeOfflinePostingTransaction}=require("./offlinePostingTransaction.service");
const {stageOfflineFinancialBatch}=require("./offlineFinancialStaging.service");
const {applyOfflineLegacyInventory}=require("./offlineLegacyInventoryWriter.service");
const {assertOfflineStagingIndexes}=require("./offlineIndexesReadiness.service");
function assertFreshOfflineStaging(staged, inventoryDeltas){
 const groups=[staged?.sales?.records,staged?.cash?.records,staged?.ledger?.entries,staged?.stock?.records];
 if(!Array.isArray(inventoryDeltas)||inventoryDeltas.length===0||
    !groups.every(records=>Array.isArray(records)&&records.length>0&&
      records.every(record=>record?.inserted===true))||
    staged.stock.records.length!==inventoryDeltas.length){
   const error=new Error("OFFLINE_INVENTORY_REPLAY_REQUIRES_RECONCILIATION");
   error.code=error.message;
   throw error;
 }
 return true;
}
async function executeOfflineInventoryStagingTransaction({db,context,eventIds,objectId}){
 await assertOfflineStagingIndexes(db);
 return executeOfflinePostingTransaction({db,context,eventIds,objectId,
  postDomainOperations:async({plan,inventoryDeltas,ledgerMovements,session,context:verifiedContext})=>{
   const staged=await stageOfflineFinancialBatch({
    db,session,context:verifiedContext,plan,inventoryDeltas,ledgerMovements
   });
   // Any reused journal entry means these stock movements may already have been
   // applied. Abort the entire transaction rather than debit legacy stock twice.
   assertFreshOfflineStaging(staged,inventoryDeltas);
   const inventory=await applyOfflineLegacyInventory({
    db,session,context:verifiedContext,inventoryDeltas,objectId
   });
   return Object.freeze({...staged,inventory,inventoryApplied:true});
  }
 });
}
module.exports={executeOfflineInventoryStagingTransaction,assertFreshOfflineStaging};
