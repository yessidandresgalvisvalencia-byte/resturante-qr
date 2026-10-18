"use strict";

const mongoose = require("mongoose");
const DecisionProof = require("../models/decisionProofPersonal.model");
const ChainHead = require("../models/decisionChainHeadPersonal.model");
const {crearAnclaVerificada} = require("../security/anclaExternaDecision.service");
const {MAX_REGISTROS} = require("./auditoriaCadenaDecision.service");

/**
 * Emite una prueba HMAC solo desde un snapshot MongoDB coherente.
 * No publica ni almacena el comprobante: el llamador debe custodiarlo
 * en un servicio externo con retención inmutable y permisos separados.
 */
async function emitirAnclaDecisionMongo(usuarioId, clave) {
 if (!mongoose.isObjectIdOrHexString(usuarioId)) throw new TypeError("usuarioId inválido");
 if (!Buffer.isBuffer(clave) || clave.length < 32) throw new TypeError("Clave HMAC inválida");
 const id = new mongoose.Types.ObjectId(String(usuarioId));
 const session = await mongoose.startSession();
 try {
  return await session.withTransaction(async () => {
   const head = await ChainHead.findOne({usuarioId:id}).session(session).lean();
   if (!head || !Number.isSafeInteger(head.secuencia) || head.secuencia < 1) {
    throw new Error("SIN_ANCLA_DE_INTEGRIDAD");
   }
   const registros = await DecisionProof.find({usuarioId:id})
    .sort({secuencia:1,_id:1})
    .limit(MAX_REGISTROS+1).session(session).lean();
   if (registros.length > MAX_REGISTROS) throw new Error("AUDITORIA_REQUIERE_PAGINACION");
   return crearAnclaVerificada({registros,head,usuarioId:String(id)},clave);
  },{
   readConcern:{level:"snapshot"},
   writeConcern:{w:"majority"},
   readPreference:"primary"
  });
 } finally {
  await session.endSession();
 }
}

module.exports = {emitirAnclaDecisionMongo};
