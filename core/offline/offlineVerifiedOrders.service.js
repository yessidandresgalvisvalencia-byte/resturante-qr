"use strict";
// Connects durable order candidates with legacy tenant/product lookup.
// Read-only: transaction and financial posting are separate responsibilities.
const {readOfflineOrderCandidates}=require("./offlinePostingCandidates.service");
const {verifyOfflineProducts}=require("./offlineProductsTenant.service");
async function prepareVerifiedOfflineOrders({db,context,eventIds,objectId}){
 if(!db||typeof db.collection!=="function")throw Object.assign(new Error("OFFLINE_DB_UNAVAILABLE"),{code:"OFFLINE_DB_UNAVAILABLE"});
 const prepared=await readOfflineOrderCandidates({db,context,eventIds});
 const productIds=await verifyOfflineProducts({collection:db.collection("productoservicios"),prepared,context,objectId});
 return Object.freeze({orders:prepared.orders,totalCop:prepared.totalCop,productIds});
}
module.exports={prepareVerifiedOfflineOrders};
