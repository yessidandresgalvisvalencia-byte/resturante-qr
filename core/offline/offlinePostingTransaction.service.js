"use strict";
// Transaction boundary for an explicit, separately reviewed domain posting callback.
// Never marks inbox events APPLIED or creates financial records by itself.
const {prepareVerifiedOfflineOrders}=require("./offlineVerifiedOrders.service");
const {calculateOfflineStockDeltas}=require("./offlineInventoryDeltas.service");
const {buildOfflineLedgerPlan}=require("./offlineLedgerPlan.service");
function error(code){const e=new Error(code);e.code=code;return e;}
async function executeOfflinePostingTransaction({db,context,eventIds,objectId,postDomainOperations}){
 if(typeof postDomainOperations!=="function")throw error("OFFLINE_POSTER_REQUIRED");
 // An internal caller must never open a database session for unscoped requests.
 const HEX=/^[a-fA-F0-9]{24}$/,ACTOR=/^[A-Za-z0-9_-]{1,80}$/,
  ULID=/^[0-9A-HJKMNP-TV-Z]{26}$/;
 if(typeof context?.empresaId!=="string"||!HEX.test(context.empresaId)||
    typeof context?.sedeId!=="string"||!HEX.test(context.sedeId)||
    typeof context?.actorId!=="string"||!ACTOR.test(context.actorId)||
    !Array.isArray(eventIds)||eventIds.length<1||eventIds.length>100||
    !Array.from({length:eventIds.length},(_,i)=>Object.hasOwn(eventIds,i)).every(Boolean)||
    eventIds.some(id=>typeof id!=="string"||!ULID.test(id))||
    new Set(eventIds).size!==eventIds.length||
    typeof objectId!=="function")throw error("OFFLINE_POSTING_TENANT_REQUIRED");
 if(typeof db?.client?.startSession!=="function")throw error("OFFLINE_TRANSACTION_UNAVAILABLE");
 const session=db.client.startSession();
 try{
  if(!session||typeof session.withTransaction!=="function")throw error("OFFLINE_TRANSACTION_UNAVAILABLE");
  let outcome;
  await session.withTransaction(async()=>{
   const plan=await prepareVerifiedOfflineOrders({db,context,eventIds,objectId,session});
   // The callback must use this session for EVERY financial write. No auto-apply.
   const inventoryDeltas=calculateOfflineStockDeltas(plan);
   const ledgerMovements=buildOfflineLedgerPlan(plan);
   outcome=await postDomainOperations(Object.freeze({plan,inventoryDeltas,ledgerMovements,session,context}));
   if(outcome===undefined||outcome===null)throw error("OFFLINE_POSTER_OUTCOME_REQUIRED");
  },{readConcern:{level:"snapshot"},writeConcern:{w:"majority"}});
  return outcome;
 }finally{
  if(session&&typeof session.endSession==="function")await session.endSession();
 }
}
module.exports={executeOfflinePostingTransaction};
