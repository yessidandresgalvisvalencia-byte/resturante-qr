"use strict";
// Authenticated inbox and explicitly authorized offline staging. No cash capture.
const express = require("express");
const mongoose = require("mongoose");
const authMiddleware = require("../core/auth/auth.middleware");
const { acceptOfflineBatch, ensureInboxIndexes } = require("../core/offline/offlineInbox.service");
const { readOfflineStatuses } = require("../core/offline/offlineStatus.service");
const { readOfflineReconciliation } = require("../core/offline/offlineReconciliation.service");
const router = express.Router();
let indexesReady = false;
router.post("/batch", authMiddleware, async (req, res) => {
  if (!req.auth?.empresaId || !req.auth?.sedeId || !req.auth?.usuarioId) {
    return res.status(403).json({ok:false,error:"OFFLINE_SEDE_AUTH_REQUIRED"});
  }
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ok:false,error:"OFFLINE_DB_UNAVAILABLE"});
  }
  const authenticatedContext = {
    empresaId:req.auth.empresaId,
    sedeId:req.auth.sedeId,
    actorId:req.auth.usuarioId
  };
  try {
    const db = mongoose.connection.db;
    // Multi-event uploads must never fall back to non-atomic writes.
    // Reply 503 so the offline outbox retries the entire batch later.
    if (Array.isArray(req.body?.events) && req.body.events.length > 1 &&
        typeof db?.client?.startSession !== "function") {
      return res.status(503).json({ok:false,error:"OFFLINE_TRANSACTION_UNAVAILABLE"});
    }
    if (!indexesReady) {
      await ensureInboxIndexes(db);
      indexesReady = true;
    }
    const result = await acceptOfflineBatch({
      db,
      authenticatedContext,
      events:req.body?.events
    });
    return res.status(202).json({ok:true,applied:false,events:result});
  } catch(error) {
    if (error?.code === "OFFLINE_TRANSACTION_UNAVAILABLE") {
      return res.status(503).json({ok:false,applied:false,error:"OFFLINE_TRANSACTION_UNAVAILABLE"});
    }
    if (error?.code === "OFFLINE_EVENT_CONFLICT") {
      return res.status(409).json({ok:false,error:"OFFLINE_EVENT_CONFLICT"});
    }
    if (typeof error?.code === "string" && error.code.startsWith("OFFLINE_")) {
      return res.status(400).json({ok:false,error:error.code});
    }
    console.error("[OFFLINE] Error interno al recibir lote:",error?.code || error?.name || "unknown");
    return res.status(500).json({ok:false,error:"OFFLINE_BATCH_UNAVAILABLE"});
  }
});
router.post("/status", authMiddleware, async (req,res)=>{
 if(!req.auth?.empresaId || !req.auth?.sedeId || !req.auth?.usuarioId)
   return res.status(403).json({ok:false,error:"OFFLINE_SEDE_AUTH_REQUIRED"});
 if(mongoose.connection.readyState!==1)
   return res.status(503).json({ok:false,error:"OFFLINE_DB_UNAVAILABLE"});
 try {
   const events=await readOfflineStatuses({
     db:mongoose.connection.db,
     context:{empresaId:req.auth.empresaId,sedeId:req.auth.sedeId,actorId:req.auth.usuarioId},
     eventIds:req.body?.eventIds
   });
   res.set("Cache-Control","no-store");
   return res.json({ok:true,events});
 } catch(error) {
   if(error.message==="OFFLINE_INVALID_IDS")return res.status(400).json({ok:false,error:"OFFLINE_INVALID_IDS"});
   if(error.message==="OFFLINE_AUTH_REQUIRED")return res.status(403).json({ok:false,error:"OFFLINE_SEDE_AUTH_REQUIRED"});
   console.error("[OFFLINE] Status failed",error?.code||error?.name||"unknown");
   return res.status(500).json({ok:false,error:"OFFLINE_STATUS_UNAVAILABLE"});
 }
});
// Read-only, tenant/actor-scoped reconciliation. Does not post payments or stock.
router.post("/reconciliation",authMiddleware,async(req,res)=>{
 if(!req.auth?.empresaId||!req.auth?.sedeId||!req.auth?.usuarioId)
  return res.status(403).json({ok:false,error:"OFFLINE_SEDE_AUTH_REQUIRED"});
 if(mongoose.connection.readyState!==1)
  return res.status(503).json({ok:false,error:"OFFLINE_DB_UNAVAILABLE"});
 try{
  const events=await readOfflineReconciliation({
   db:mongoose.connection.db,
   context:{empresaId:req.auth.empresaId,sedeId:req.auth.sedeId,actorId:req.auth.usuarioId},
   eventIds:req.body?.eventIds
  });
  res.set("Cache-Control","no-store");
  return res.json({ok:true,readOnly:true,events});
 }catch(error){
  if(error?.code==="OFFLINE_AUTH_REQUIRED")return res.status(403).json({ok:false,error:error.code});
  if(error?.code==="OFFLINE_INVALID_IDS")return res.status(400).json({ok:false,error:error.code});
  console.error("[OFFLINE] Reconciliation unavailable",error?.code||error?.name||"unknown");
  return res.status(500).json({ok:false,error:"OFFLINE_RECONCILIATION_UNAVAILABLE"});
 }
});
// Explicit, ADMIN-only posting of OWN pending offline orders: atomic journals+stock.
// This is NOT a payment, a fiscal sale, nor proof of final reconciliation.
router.post("/stage-orders",authMiddleware,async(req,res)=>{
 if(!req.auth?.empresaId||!req.auth?.sedeId||!req.auth?.usuarioId||
    !["DUEÑO","ADMIN_SEDE"].includes(req.auth.rol))
  return res.status(403).json({ok:false,error:"OFFLINE_STAGE_PERMISSION_DENIED"});
 if(mongoose.connection.readyState!==1)
  return res.status(503).json({ok:false,error:"OFFLINE_DB_UNAVAILABLE"});
 try{
  const {stageAuthorizedOfflineOrders}=require("../core/offline/offlineAdminStage.service");
  const result=await stageAuthorizedOfflineOrders({
   db:mongoose.connection.db,auth:req.auth,
   eventIds:req.body?.eventIds,confirmed:req.body?.confirmed
  });
  res.set("Cache-Control","no-store");
  return res.status(result.status==="REQUIERE_REVISION_STOCK"?409:result.alreadyStaged===true?200:202)
   .json({ok:result.status!=="REQUIERE_REVISION_STOCK",...result});
 }catch(error){
  const code=error?.code;
  if(["OFFLINE_STAGE_PERMISSION_DENIED","OFFLINE_STAGE_IDENTITY_NOT_MAPPED"].includes(code))
   return res.status(403).json({ok:false,error:code});
  if(["OFFLINE_INVALID_IDS","OFFLINE_STAGE_CONFIRMATION_REQUIRED"].includes(code))
   return res.status(400).json({ok:false,error:code});
  if(["OFFLINE_TRANSACTION_UNAVAILABLE","OFFLINE_INDEX_NOT_READY","OFFLINE_DB_UNAVAILABLE"].includes(code))
   return res.status(503).json({ok:false,error:code});
  if(typeof code==="string"&&code.startsWith("OFFLINE_"))
   return res.status(409).json({ok:false,error:code});
  console.error("[OFFLINE] Stage orders unavailable",code||error?.name||"unknown");
  return res.status(500).json({ok:false,error:"OFFLINE_STAGE_UNAVAILABLE"});
 }
});
// Authenticated read-only product snapshot for this exact tenant+site.
router.get("/catalog",authMiddleware,async(req,res)=>{
 if(!req.auth?.empresaId||!req.auth?.sedeId||!req.auth?.usuarioId)
  return res.status(403).json({ok:false,error:"OFFLINE_SEDE_AUTH_REQUIRED"});
 if(mongoose.connection.readyState!==1)
  return res.status(503).json({ok:false,error:"OFFLINE_DB_UNAVAILABLE"});
 try{
  const {readOfflineCatalog}=require("../core/offline/offlineCatalog.service");
  const result=await readOfflineCatalog({db:mongoose.connection.db,context:{
   empresaId:req.auth.empresaId,sedeId:req.auth.sedeId,actorId:req.auth.usuarioId
  },objectId:id=>new mongoose.Types.ObjectId(id)});
  res.set("Cache-Control","no-store");
  return res.json({ok:true,...result});
 }catch(error){
  if(error?.code==="OFFLINE_CATALOG_AUTH_REQUIRED")return res.status(403).json({ok:false,error:error.code});
  if(typeof error?.code==="string"&&error.code.startsWith("OFFLINE_CATALOG_"))
   return res.status(409).json({ok:false,error:error.code});
  console.error("[OFFLINE] Catalog unavailable",error?.code||error?.name||"unknown");
  return res.status(500).json({ok:false,error:"OFFLINE_CATALOG_UNAVAILABLE"});
 }
});
// Read-only inventory baseline; never apply tablet estimates as ledger mutations.
router.get("/stock-snapshot",authMiddleware,async(req,res)=>{
 if(!req.auth?.empresaId||!req.auth?.sedeId||!req.auth?.usuarioId)
  return res.status(403).json({ok:false,error:"OFFLINE_SEDE_AUTH_REQUIRED"});
 if(mongoose.connection.readyState!==1)
  return res.status(503).json({ok:false,error:"OFFLINE_DB_UNAVAILABLE"});
 try{
  const {readOfflineStockSnapshot}=require("../core/offline/offlineStockSnapshot.service");
  const snapshot=await readOfflineStockSnapshot({
   db:mongoose.connection.db,
   context:{empresaId:req.auth.empresaId,sedeId:req.auth.sedeId,actorId:req.auth.usuarioId},
   objectId:id=>new mongoose.Types.ObjectId(id)
  });
  res.set("Cache-Control","no-store");
  return res.json({ok:true,...snapshot});
 }catch(error){
  if(error?.code==="OFFLINE_STOCK_AUTH_REQUIRED")return res.status(403).json({ok:false,error:error.code});
  if(typeof error?.code==="string"&&error.code.startsWith("OFFLINE_STOCK_"))
   return res.status(409).json({ok:false,error:error.code});
  console.error("[OFFLINE] Stock snapshot unavailable",error?.code||error?.name||"unknown");
  return res.status(500).json({ok:false,error:"OFFLINE_STOCK_UNAVAILABLE"});
 }
});
// Explicit ADMIN-only conflict review, separated from inventory and cash writes.
router.get("/stock-conflicts",authMiddleware,async(req,res)=>{
 if(!req.auth?.usuarioId||!["DUEÑO","ADMIN_SEDE"].includes(req.auth.rol))
  return res.status(403).json({ok:false,error:"OFFLINE_CONFLICT_PERMISSION_DENIED"});
 if(mongoose.connection.readyState!==1)
  return res.status(503).json({ok:false,error:"OFFLINE_DB_UNAVAILABLE"});
 try{
  const {listStockConflicts}=require("../core/offline/offlineConflictAdmin.service");
  const records=await listStockConflicts({db:mongoose.connection.db,auth:req.auth,limit:50});
  res.set("Cache-Control","no-store");
  return res.json({ok:true,readOnly:true,conflicts:records});
 }catch(error){
  if(error?.code==="OFFLINE_CONFLICT_PERMISSION_DENIED")return res.status(403).json({ok:false,error:error.code});
  console.error("[OFFLINE] Conflict list unavailable",error?.code||error?.name||"unknown");
  return res.status(500).json({ok:false,error:"OFFLINE_CONFLICT_LIST_UNAVAILABLE"});
 }
});
router.post("/stock-conflicts/review",authMiddleware,async(req,res)=>{
 if(!req.auth?.usuarioId||!["DUEÑO","ADMIN_SEDE"].includes(req.auth.rol))
  return res.status(403).json({ok:false,error:"OFFLINE_CONFLICT_PERMISSION_DENIED"});
 if(mongoose.connection.readyState!==1)
  return res.status(503).json({ok:false,error:"OFFLINE_DB_UNAVAILABLE"});
 try{
  const {appendStockConflictReview}=require("../core/offline/offlineConflictAdmin.service");
  const result=await appendStockConflictReview({db:mongoose.connection.db,auth:req.auth,
   conflictId:req.body?.conflictId,decisionId:req.body?.decisionId,
   action:req.body?.action,note:req.body?.note});
  res.set("Cache-Control","no-store");
  return res.status(201).json({ok:true,...result});
 }catch(error){
  const code=error?.code;
  if(code==="OFFLINE_CONFLICT_PERMISSION_DENIED")
   return res.status(403).json({ok:false,error:code});
  if(code==="OFFLINE_CONFLICT_REVIEW_INVALID")
   return res.status(400).json({ok:false,error:code});
  if(code==="OFFLINE_CONFLICT_NOT_FOUND")
   return res.status(404).json({ok:false,error:code});
  if(code==="OFFLINE_CONFLICT_REVIEW_IDEMPOTENCY_CONFLICT")
   return res.status(409).json({ok:false,error:code});
  console.error("[OFFLINE] Conflict review unavailable",code||error?.name||"unknown");
  return res.status(500).json({ok:false,error:"OFFLINE_CONFLICT_REVIEW_UNAVAILABLE"});
 }
});
// Read-only recheck of current server stock versus the ORIGINAL pending orders.
// A positive result is informational, never an authorization to mutate stock.
router.get("/stock-conflicts/preflight",authMiddleware,async(req,res)=>{
 if(!req.auth?.usuarioId||!["DUEÑO","ADMIN_SEDE"].includes(req.auth.rol))
  return res.status(403).json({ok:false,error:"OFFLINE_CONFLICT_PERMISSION_DENIED"});
 if(mongoose.connection.readyState!==1)
  return res.status(503).json({ok:false,error:"OFFLINE_DB_UNAVAILABLE"});
 try{
  const {preflightOfflineConflict}=require("../core/offline/offlineConflictPreflight.service");
  const result=await preflightOfflineConflict({
   db:mongoose.connection.db,auth:req.auth,conflictId:req.query?.conflictId,
   objectId:id=>new mongoose.Types.ObjectId(id)
  });
  res.set("Cache-Control","no-store");
  return res.json({ok:true,readOnly:true,...result});
 }catch(error){
  if(error?.code==="OFFLINE_CONFLICT_PERMISSION_DENIED")
   return res.status(403).json({ok:false,error:error.code});
  if(error?.code==="OFFLINE_CONFLICT_INVALID_ID")
   return res.status(400).json({ok:false,error:error.code});
  if(error?.code==="OFFLINE_CONFLICT_NOT_FOUND")
   return res.status(404).json({ok:false,error:error.code});
  console.error("[OFFLINE] Stock preflight unavailable",error?.code||error?.name||"unknown");
  return res.status(500).json({ok:false,error:"OFFLINE_CONFLICT_PREFLIGHT_UNAVAILABLE"});
 }
});
// Explicit supervisor retry: recheck stock and record resolution within the
// SAME Mongo transaction. Does not charge payments or mark final APPLIED.
router.post("/stock-conflicts/retry",authMiddleware,async(req,res)=>{
 if(!req.auth?.usuarioId||!["DUEÑO","ADMIN_SEDE"].includes(req.auth.rol))
  return res.status(403).json({ok:false,error:"OFFLINE_CONFLICT_PERMISSION_DENIED"});
 if(mongoose.connection.readyState!==1)
  return res.status(503).json({ok:false,error:"OFFLINE_DB_UNAVAILABLE"});
 try{
  const {retryOfflineConflict}=require("../core/offline/offlineConflictRetry.service");
  const result=await retryOfflineConflict({db:mongoose.connection.db,auth:req.auth,
   conflictId:req.body?.conflictId,confirmed:req.body?.confirmed,note:req.body?.note});
  res.set("Cache-Control","no-store");
  return res.status(result.alreadyResolved?200:202).json({ok:true,...result});
 }catch(error){
  const code=error?.code;
  if(code==="OFFLINE_CONFLICT_PERMISSION_DENIED")return res.status(403).json({ok:false,error:code});
  if(["OFFLINE_CONFLICT_RETRY_INVALID","OFFLINE_CONFLICT_RETRY_CONFIRMATION_REQUIRED"].includes(code))
   return res.status(400).json({ok:false,error:code});
  if(code==="OFFLINE_CONFLICT_NOT_FOUND")return res.status(404).json({ok:false,error:code});
  if(["OFFLINE_TRANSACTION_UNAVAILABLE","OFFLINE_INDEX_NOT_READY"].includes(code))
   return res.status(503).json({ok:false,error:code});
  if(typeof code==="string"&&code.startsWith("OFFLINE_"))
   return res.status(409).json({ok:false,error:code,applied:false,cobrado:false});
  console.error("[OFFLINE] Conflict retry failed",code||error?.name||"unknown");
  return res.status(500).json({ok:false,error:"OFFLINE_CONFLICT_RETRY_UNAVAILABLE"});
 }
});
module.exports = router;
