"use strict";

const mongoose = require("mongoose");
const DecisionProof = require("../models/decisionProofPersonal.model");
const ChainHead = require("../models/decisionChainHeadPersonal.model");
const {crearAnclaVerificada,verificarAncla} = require("../security/anclaExternaDecision.service");
const {MAX_REGISTROS} = require("./auditoriaCadenaDecision.service");

/**
 * Emite una prueba HMAC solo desde un snapshot MongoDB coherente.
 * No publica ni almacena el comprobante: el llamador debe custodiarlo
 * en un servicio externo con retención inmutable y permisos separados.
 */
async function emitirAnclaDecisionMongo(usuarioId, clave, opciones = {}) {
 if (!mongoose.isObjectIdOrHexString(usuarioId)) throw new TypeError("usuarioId inválido");
 if (!Buffer.isBuffer(clave) || clave.length < 32) throw new TypeError("Clave HMAC inválida");
 if (!opciones || typeof opciones !== "object" || Array.isArray(opciones) ||
     Object.keys(opciones).some(k => k !== "anclaPrevia")) throw new TypeError("Opciones de ancla inválidas");
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
   // La ancla previa debe provenir de custodia externa independiente, nunca
   // de una petición no autenticada ni de la propia base bajo auditoría.
   if (Object.hasOwn(opciones,"anclaPrevia")) {
    const previa=verificarAncla(opciones.anclaPrevia,clave,registros,head,String(id));
    if (!previa.valida) {
     const error=new Error("CONTINUIDAD_ANCLA_INVALIDA");
     error.code=previa.codigo;
     throw error;
    }
   }
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

/**
 * Compara una ancla obtenida de custodia independiente contra el historial
 * real de MongoDB, leído en una instantánea transaccional.
 * Nunca acepta registros financieros suministrados por el cliente.
 */
async function verificarAnclaDecisionMongo(usuarioId, clave, anclaExterna) {
 if (!mongoose.isObjectIdOrHexString(usuarioId)) throw new TypeError("usuarioId inválido");
 if (!Buffer.isBuffer(clave) || clave.length < 32) throw new TypeError("Clave HMAC inválida");
 if (!anclaExterna || typeof anclaExterna !== "object" || Array.isArray(anclaExterna)) {
  throw new TypeError("Ancla externa obligatoria");
 }
 const id=new mongoose.Types.ObjectId(String(usuarioId));
 const session=await mongoose.startSession();
 try {
  return await session.withTransaction(async()=>{
   const head=await ChainHead.findOne({usuarioId:id}).session(session).lean();
   const registros=await DecisionProof.find({usuarioId:id})
    .sort({secuencia:1,_id:1}).limit(MAX_REGISTROS+1)
    .session(session).lean();
   if (registros.length>MAX_REGISTROS) {
    return {valida:false,codigo:"AUDITORIA_REQUIERE_PAGINACION"};
   }
   return verificarAncla(anclaExterna,clave,registros,head,String(id));
  },{
   readConcern:{level:"snapshot"},
   writeConcern:{w:"majority"},
   readPreference:"primary"
  });
 } finally {
  await session.endSession();
 }
}

module.exports = {emitirAnclaDecisionMongo,verificarAnclaDecisionMongo};
