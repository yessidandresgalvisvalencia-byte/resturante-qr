"use strict";
// Transaction boundary for an explicit, separately reviewed domain posting callback.
// Never marks inbox events APPLIED or creates financial records by itself.
const {prepareVerifiedOfflineOrders}=require("./offlineVerifiedOrders.service");
const {calculateOfflineStockDeltas}=require("./offlineInventoryDeltas.service");
function error(code){const e=new Error(code);e.code=code;return e;}
async function executeOfflinePostingTransaction({db,context,eventIds,objectId,postDomainOperations}){
 if(typeof postDomainOperations!=="function")throw error("OFFLINE_POSTER_REQUIRED");
 if(typeof db?.client?.startSession!=="function")throw error("OFFLINE_TRANSACTION_UNAVAILABLE");
 const session=db.client.startSession();
 try{
  if(!session||typeof session.withTransaction!=="function")throw error("OFFLINE_TRANSACTION_UNAVAILABLE");
  let outcome;
  await session.withTransaction(async()=>{
   const plan=await prepareVerifiedOfflineOrders({db,context,eventIds,objectId,session});
   // The callback must use this session for EVERY financial write. No auto-apply.
   const inventoryDeltas=calculateOfflineStockDeltas(plan);
   outcome=await postDomainOperations(Object.freeze({plan,inventoryDeltas,session,context}));
   if(outcome===undefined||outcome===null)throw error("OFFLINE_POSTER_OUTCOME_REQUIRED");
  },{readConcern:{level:"snapshot"},writeConcern:{w:"majority"}});
  return outcome;
 }finally{
  if(session&&typeof session.endSession==="function")await session.endSession();
 }
}
module.exports={executeOfflinePostingTransaction};
