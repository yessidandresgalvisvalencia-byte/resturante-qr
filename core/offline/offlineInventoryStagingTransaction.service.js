"use strict";
// Internal-only: stage all four financial journals and decrement mapped inventory
// in one Mongo transaction. This does NOT settle cash or mark inbox APPLIED.
const {executeOfflinePostingTransaction}=require("./offlinePostingTransaction.service");
const {stageOfflineFinancialBatch}=require("./offlineFinancialStaging.service");
const {applyOfflineLegacyInventory}=require("./offlineLegacyInventoryWriter.service");
const {assertOfflineStagingIndexes}=require("./offlineIndexesReadiness.service");
function assertFreshOfflineStaging(staged,inventoryDeltas,plan){
 const code="OFFLINE_INVENTORY_REPLAY_REQUIRES_RECONCILIATION";
 const fail=()=>{const error=new Error(code);error.code=code;throw error;};
 if(!Array.isArray(plan?.orders)||plan.orders.length===0||
    !Array.isArray(inventoryDeltas)||inventoryDeltas.length===0)fail();
 const eventIds=plan.orders.map(order=>order?.eventId);
 const productIds=inventoryDeltas.map(delta=>delta?.productoId);
 if(eventIds.some(id=>typeof id!=="string"||!id)||
    productIds.some(id=>typeof id!=="string"||!id)||
    new Set(eventIds).size!==eventIds.length||
    new Set(productIds).size!==productIds.length)fail();
 // Every journal must prove one FRESH write per planned event, never merely
 // one arbitrary inserted record. The stock journal must match product deltas.
 const expected=[
   [staged?.sales?.records,eventIds,"eventId"],
   [staged?.cash?.records,eventIds,"eventId"],
   [staged?.ledger?.entries,eventIds,"eventId"],
   [staged?.stock?.records,productIds,"productoId"]
 ];
 for(const [records,ids,field] of expected){
   if(!Array.isArray(records)||records.length!==ids.length)fail();
   const expectedIds=new Set(ids);
   const actualIds=new Set();
   for(const record of records){
     const id=record?.[field];
     if(record?.inserted!==true||!expectedIds.has(id)||actualIds.has(id))fail();
     actualIds.add(id);
   }
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
   assertFreshOfflineStaging(staged,inventoryDeltas,plan);
   const inventory=await applyOfflineLegacyInventory({
    db,session,context:verifiedContext,inventoryDeltas,objectId
   });
   return Object.freeze({...staged,inventory,inventoryApplied:true});
  }
 });
}
module.exports={executeOfflineInventoryStagingTransaction,assertFreshOfflineStaging};
