"use strict";
// A supervisor may retry the ORIGINAL actor's pending orders, never arbitrary IDs.
// Resolution proof is inserted in the SAME Mongo snapshot transaction as stock
// debit, sale/cash intentions, ledger and inbox transition. No payment settlement.
const {ObjectId}=require("mongodb");
const {executeOfflineInventoryStagingTransaction}=require("./offlineInventoryStagingTransaction.service");
const {readOfflineReconciliation}=require("./offlineReconciliation.service");
const SHA=/^offline-stock-[a-f0-9]{64}$/,HEX=/^[a-fA-F0-9]{24}$/,ID=/^[A-Za-z0-9_-]{1,80}$/;
const ULID=/^[0-9A-HJKMNP-TV-Z]{26}$/;
function fail(code){const e=new Error(code);e.code=code;throw e;}
function assertAuthorization(auth,conflictId,confirmed,note){
 if(!auth||!["DUEÑO","ADMIN_SEDE"].includes(auth.rol)||
  !HEX.test(auth.empresaId||"")||!HEX.test(auth.sedeId||"")||
  !ID.test(auth.usuarioId||""))fail("OFFLINE_CONFLICT_PERMISSION_DENIED");
 if(!SHA.test(conflictId||"")||typeof note!=="string"||
  note.trim().length<10||note.trim().length>500)fail("OFFLINE_CONFLICT_RETRY_INVALID");
 if(confirmed!==true)fail("OFFLINE_CONFLICT_RETRY_CONFIRMATION_REQUIRED");
 return {empresaId:auth.empresaId,sedeId:auth.sedeId};
}
function validateSource(doc){
 if(!doc||!ID.test(doc.actorId||"")||!Array.isArray(doc.eventIds)||
   doc.eventIds.length<1||doc.eventIds.length>100||
   doc.eventIds.some(id=>typeof id!=="string"||!ULID.test(id))||
   new Set(doc.eventIds).size!==doc.eventIds.length)
   fail("OFFLINE_CONFLICT_RETRY_SOURCE_INVALID");
}
async function retryOfflineConflict({db,auth,conflictId,confirmed,note}){
 const tenant=assertAuthorization(auth,conflictId,confirmed,note);
 if(typeof db?.client?.startSession!=="function")fail("OFFLINE_TRANSACTION_UNAVAILABLE");
 const query={_id:conflictId,...tenant,status:"REQUIERE_REVISION",applied:false,cobrado:false};
 const conflictCollection=db.collection("gruk_offline_stock_conflicts");
 const resolutionCollection=db.collection("gruk_offline_stock_resolutions");
 const source=await conflictCollection.findOne(query,{projection:{actorId:1,eventIds:1}});
 if(!source)fail("OFFLINE_CONFLICT_NOT_FOUND");
 validateSource(source);
 const context={...tenant,actorId:source.actorId},eventIds=source.eventIds;
 const resolutionKey={_id:conflictId,...tenant};
 const existing=await resolutionCollection.findOne(resolutionKey);
 if(existing){
  if(existing.status!=="STAGED"||existing.actorId!==context.actorId||
     existing.eventIds.join(",")!==eventIds.join(","))fail("OFFLINE_CONFLICT_RESOLUTION_INCONSISTENT");
  const statuses=await readOfflineReconciliation({db,context,eventIds});
  if(statuses.length!==eventIds.length||statuses.some(x=>
    x.status!=="EN_REVISION"||x.staged!==true||x.applied!==false))
    fail("OFFLINE_CONFLICT_RESOLUTION_INCONSISTENT");
  return Object.freeze({conflictId,alreadyResolved:true,status:"STAGED",
   events:eventIds.length,inventoryApplied:true,applied:false,cobrado:false});
 }
 const onStaged=async({session,context:verifiedContext,plan})=>{
  if(session?.inTransaction?.()!==true||
     verifiedContext.actorId!==source.actorId||
     plan.orders.length!==eventIds.length||
     new Set(plan.orders.map(x=>x.eventId)).size!==eventIds.length||
     plan.orders.some(x=>!eventIds.includes(x.eventId)))
    fail("OFFLINE_CONFLICT_RESOLUTION_INCONSISTENT");
  // Re-read source under transaction: may not resolve a changed/revoked conflict.
  const valid=await conflictCollection.findOne(query,{session,projection:{_id:1}});
  if(!valid)fail("OFFLINE_CONFLICT_NOT_FOUND");
  try{
   await resolutionCollection.insertOne({
    ...resolutionKey,actorId:source.actorId,eventIds:[...eventIds],
    status:"STAGED",approvedBy:auth.usuarioId,note:note.trim(),
    stagedAt:new Date(),applied:false,cobrado:false
   },{session});
  }catch(error){
   if(error?.code===11000)fail("OFFLINE_CONFLICT_RESOLUTION_ALREADY_EXISTS");
   throw error;
  }
 };
 const staged=await executeOfflineInventoryStagingTransaction({
  db,context,eventIds,objectId:value=>new ObjectId(value),
  requireAuthoritativePricing:true,onStaged
 });
 if(staged.status!=="PENDIENTE_CONTABILIZACION"||staged.inventoryApplied!==true)
  fail("OFFLINE_CONFLICT_RESOLUTION_INCONSISTENT");
 return Object.freeze({conflictId,alreadyResolved:false,status:"STAGED",
  events:eventIds.length,inventoryApplied:true,applied:false,cobrado:false,
  totalCop:staged.sales.totalCop});
}
module.exports={retryOfflineConflict,assertAuthorization};
