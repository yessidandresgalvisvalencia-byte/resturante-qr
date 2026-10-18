"use strict";
// Internal-only: stage all four financial journals and decrement mapped inventory
// in one Mongo transaction. This does NOT settle cash or mark inbox APPLIED.
const {executeOfflinePostingTransaction}=require("./offlinePostingTransaction.service");
const {stageOfflineFinancialBatch}=require("./offlineFinancialStaging.service");
const {applyOfflineLegacyInventory}=require("./offlineLegacyInventoryWriter.service");
const {assertOfflineStagingIndexes}=require("./offlineIndexesReadiness.service");
const {assertOfflineAuthoritativePrices}=require("./offlineAuthoritativePrices.service");
const {markOfflineStagedInTransaction}=require("./offlineInboxStaged.service");
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
function assertAppliedOfflineInventory(inventory,inventoryDeltas){
 const code="OFFLINE_INVENTORY_RESULT_CONFLICT";
 const fail=()=>{const error=new Error(code);error.code=code;throw error;};
 if(!Array.isArray(inventory)||!Array.isArray(inventoryDeltas)||
    inventory.length===0||inventory.length!==inventoryDeltas.length)fail();
 const expected=new Map();
 for(const delta of inventoryDeltas){
   if(typeof delta?.productoId!=="string"||!delta.productoId||
      typeof delta.deltaUnidades!=="string"||!/^-[1-9][0-9]*$/.test(delta.deltaUnidades)||
      expected.has(delta.productoId))fail();
   expected.set(delta.productoId,-BigInt(delta.deltaUnidades));
 }
 const seen=new Set();
 for(const result of inventory){
   if(typeof result?.productoId!=="string"||!expected.has(result.productoId)||
      seen.has(result.productoId)||typeof result.antes!=="string"||
      typeof result.despues!=="string"||
      !/^(0|[1-9][0-9]*)$/.test(result.antes)||
      !/^(0|[1-9][0-9]*)$/.test(result.despues))fail();
   const before=BigInt(result.antes),after=BigInt(result.despues);
   if(before-after!==expected.get(result.productoId))fail();
   seen.add(result.productoId);
 }
 return true;
}
async function executeOfflineInventoryStagingTransaction({db,context,eventIds,objectId,requireAuthoritativePricing=false,onStaged=null}){
 await assertOfflineStagingIndexes(db);
 return executeOfflinePostingTransaction({db,context,eventIds,objectId,
  postDomainOperations:async({plan,inventoryDeltas,ledgerMovements,session,context:verifiedContext})=>{
   if(requireAuthoritativePricing===true)
    await assertOfflineAuthoritativePrices({db,session,context:verifiedContext,plan,objectId});
   const staged=await stageOfflineFinancialBatch({
    db,session,context:verifiedContext,plan,inventoryDeltas,ledgerMovements
   });
   // Any reused journal entry means these stock movements may already have been
   // applied. Abort the entire transaction rather than debit legacy stock twice.
   assertFreshOfflineStaging(staged,inventoryDeltas,plan);
   const inventory=await applyOfflineLegacyInventory({
    db,session,context:verifiedContext,inventoryDeltas,objectId
   });
   // A database writer may only authorize commit after confirming the exact
   // product-by-product quantities actually debited in this transaction.
   assertAppliedOfflineInventory(inventory,inventoryDeltas);
   // Fail closed if even one inbox status cannot be advanced with these writes.
   const handoffs=await markOfflineStagedInTransaction({db,session,context:verifiedContext,plan});
   if(onStaged!==null){
    if(typeof onStaged!=="function")throw Error("OFFLINE_STAGE_HOOK_INVALID");
    await onStaged({db,session,context:verifiedContext,plan,inventory,staged});
   }
   return Object.freeze({...staged,inventory,inventoryApplied:true,handoffs});
  }
 });
}
module.exports={executeOfflineInventoryStagingTransaction,assertFreshOfflineStaging,assertAppliedOfflineInventory};
