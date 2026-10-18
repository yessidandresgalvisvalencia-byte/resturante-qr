"use strict";
// Explicit operator-authorized posting of OWN received offline orders.
// Changes legacy inventory transactionally. NEVER settles payment or marks APPLIED.
const {ObjectId}=require("mongodb");
const {executeOfflineInventoryStagingTransaction}=require("./offlineInventoryStagingTransaction.service");
const {recoverOfflineStagedBatch}=require("./offlineStageRecovery.service");
const {recordOfflineOversellConflict}=require("./offlineOversellAudit.service");
const ULID=/^[0-9A-HJKMNP-TV-Z]{26}$/;
const SAFE=/^[A-Za-z0-9_-]{1,80}$/;
const ROLES=new Set(["DUEÑO","ADMIN_SEDE"]);
function fail(code){const error=new Error(code);error.code=code;throw error;}
function validateAdminStage({auth,eventIds,confirmed}){
 if(!auth||!ROLES.has(auth.rol)||[auth.empresaId,auth.sedeId,auth.usuarioId].some(id=>typeof id!=="string"||!SAFE.test(id)))
  fail("OFFLINE_STAGE_PERMISSION_DENIED");
 if(confirmed!==true)fail("OFFLINE_STAGE_CONFIRMATION_REQUIRED");
 if(!Array.isArray(eventIds)||eventIds.length<1||eventIds.length>100||
   eventIds.some(id=>typeof id!=="string"||!ULID.test(id))||
   new Set(eventIds).size!==eventIds.length)fail("OFFLINE_INVALID_IDS");
 if(!ObjectId.isValid(auth.empresaId)||!ObjectId.isValid(auth.sedeId))
  fail("OFFLINE_STAGE_IDENTITY_NOT_MAPPED");
 return {empresaId:auth.empresaId,sedeId:auth.sedeId,actorId:auth.usuarioId};
}
async function stageAuthorizedOfflineOrders({db,auth,eventIds,confirmed}){
 const context=validateAdminStage({auth,eventIds,confirmed});
 if(typeof db?.client?.startSession!=="function")fail("OFFLINE_TRANSACTION_UNAVAILABLE");
 let staged;
 try{
  staged=await executeOfflineInventoryStagingTransaction({
   db,context,eventIds,objectId:id=>new ObjectId(id),requireAuthoritativePricing:true
  });
 }catch(error){
  if(error?.code==="OFFLINE_INVENTORY_INSUFFICIENT")
   return recordOfflineOversellConflict({db,context,eventIds,objectId:id=>new ObjectId(id)});
  if(error?.code!=="OFFLINE_ORDERS_NOT_PENDING")throw error;
  // Read-only confirmation only if every requested event is fully staged.
  return recoverOfflineStagedBatch({db,context,eventIds});
 }
 if(staged.status!=="PENDIENTE_CONTABILIZACION"||staged.inventoryApplied!==true)
  fail("OFFLINE_STAGE_OUTCOME_CONFLICT");
 return Object.freeze({
  status:"PENDIENTE_CONTABILIZACION",applied:false,cobrado:false,
  processedEvents:eventIds.length,stockMovements:staged.inventory.length,
  totalCop:staged.sales.totalCop
 });
}
module.exports={stageAuthorizedOfflineOrders,validateAdminStage};
