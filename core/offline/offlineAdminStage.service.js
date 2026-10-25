"use strict";
// Explicit operator-authorized posting of OWN received offline orders.
// Changes legacy inventory transactionally. NEVER settles payment or marks APPLIED.
const {mongo:{ObjectId}}=require("mongoose");
const {executeOfflineInventoryStagingTransaction}=require("./offlineInventoryStagingTransaction.service");
const {recoverOfflineStagedBatch}=require("./offlineStageRecovery.service");
const {recordOfflineOversellConflict}=require("./offlineOversellAudit.service");
const ULID=/^[0-9A-HJKMNP-TV-Z]{26}$/;
const SAFE=/^[A-Za-z0-9_-]{1,80}$/;
const ROLES=new Set(["DUEÑO","ADMIN_SEDE"]);
function fail(code){const error=new Error(code);error.code=code;throw error;}
function validatedRequest({auth,eventIds,confirmed}){
 if(!auth||typeof auth!=="object"||Array.isArray(auth))
  fail("OFFLINE_STAGE_PERMISSION_DENIED");
 const scope={};
 for(const field of ["rol","empresaId","sedeId","usuarioId"]){
  const descriptor=Object.getOwnPropertyDescriptor(auth,field);
  if(!descriptor||!("value" in descriptor))
   fail("OFFLINE_STAGE_PERMISSION_DENIED");
  scope[field]=descriptor.value;
 }
 if(!ROLES.has(scope.rol)||["empresaId","sedeId","usuarioId"].some(
  field=>typeof scope[field]!=="string"||!SAFE.test(scope[field])))
  fail("OFFLINE_STAGE_PERMISSION_DENIED");
 if(confirmed!==true)fail("OFFLINE_STAGE_CONFIRMATION_REQUIRED");
 if(!Array.isArray(eventIds)||eventIds.length<1||eventIds.length>100)
  fail("OFFLINE_INVALID_IDS");
 const capturedIds=[];
 for(let i=0;i<eventIds.length;i++){
  const descriptor=Object.getOwnPropertyDescriptor(eventIds,String(i));
  if(!descriptor||!("value" in descriptor)||typeof descriptor.value!=="string"||
     !ULID.test(descriptor.value))fail("OFFLINE_INVALID_IDS");
  capturedIds.push(descriptor.value);
 }
 if(new Set(capturedIds).size!==capturedIds.length)fail("OFFLINE_INVALID_IDS");
 if(!ObjectId.isValid(scope.empresaId)||!ObjectId.isValid(scope.sedeId))
  fail("OFFLINE_STAGE_IDENTITY_NOT_MAPPED");
 return Object.freeze({
  context:Object.freeze({empresaId:scope.empresaId,sedeId:scope.sedeId,actorId:scope.usuarioId}),
  eventIds:Object.freeze(capturedIds)
 });
}
function validateAdminStage(request){return validatedRequest(request).context;}
async function stageAuthorizedOfflineOrders({db,auth,eventIds,confirmed}){
 const verified=validatedRequest({auth,eventIds,confirmed});
 const {context,eventIds:ids}=verified;
 if(typeof db?.client?.startSession!=="function")fail("OFFLINE_TRANSACTION_UNAVAILABLE");
 let staged;
 try{
  staged=await executeOfflineInventoryStagingTransaction({
   db,context,eventIds:ids,objectId:id=>new ObjectId(id),requireAuthoritativePricing:true
  });
 }catch(error){
  if(error?.code==="OFFLINE_INVENTORY_INSUFFICIENT")
   return recordOfflineOversellConflict({db,context,eventIds:ids,objectId:id=>new ObjectId(id)});
  if(error?.code!=="OFFLINE_ORDERS_NOT_PENDING")throw error;
  // Read-only confirmation only if every requested event is fully staged.
  return recoverOfflineStagedBatch({db,context,eventIds:ids});
 }
 if(staged.status!=="PENDIENTE_CONTABILIZACION"||staged.inventoryApplied!==true)
  fail("OFFLINE_STAGE_OUTCOME_CONFLICT");
 return Object.freeze({
  status:"PENDIENTE_CONTABILIZACION",applied:false,cobrado:false,
  processedEvents:ids.length,stockMovements:staged.inventory.length,
  totalCop:staged.sales.totalCop
 });
}
module.exports={stageAuthorizedOfflineOrders,validateAdminStage};
