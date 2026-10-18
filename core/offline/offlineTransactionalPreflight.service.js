"use strict";
// A consistent Mongo transaction snapshot for offline order preflight.
// No sales, payments, inventory or ledger writes are performed.
const {prepareVerifiedOfflineOrders}=require("./offlineVerifiedOrders.service");
function unavailable(){const e=new Error("OFFLINE_TRANSACTION_UNAVAILABLE");e.code="OFFLINE_TRANSACTION_UNAVAILABLE";return e;}
async function prepareOfflineOrdersInTransaction({db,context,eventIds,objectId}){
 if(typeof db?.client?.startSession!=="function")throw unavailable();
 const session=db.client.startSession();
 try{
   if(!session||typeof session.withTransaction!=="function")throw unavailable();
   let plan;
   await session.withTransaction(async()=>{
     plan=await prepareVerifiedOfflineOrders({db,context,eventIds,objectId,session});
   },{readConcern:{level:"snapshot"},writeConcern:{w:"majority"}});
   return plan;
 }finally{
   if(session&&typeof session.endSession==="function")await session.endSession();
 }
}
module.exports={prepareOfflineOrdersInTransaction};
