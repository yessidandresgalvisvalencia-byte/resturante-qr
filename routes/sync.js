"use strict";
// Authenticated offline inbox only. No financial, stock or order posting.
const express = require("express");
const mongoose = require("mongoose");
const authMiddleware = require("../core/auth/auth.middleware");
const { acceptOfflineBatch, ensureInboxIndexes } = require("../core/offline/offlineInbox.service");
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
module.exports = router;
