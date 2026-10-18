"use strict";

const mongoose = require("mongoose");
const DecisionProof = require("../models/decisionProofPersonal.model");
const ChainHead = require("../models/decisionChainHeadPersonal.model");
const { verificarCadena } = require("./verificarCadenaDecision.service");

// Una instantánea consistente evita comparar movimientos y head de instantes distintos.
// El límite impide cargar cadenas arbitrariamente grandes en memoria.
const MAX_REGISTROS = 10000;

async function auditarCadenaUsuario(usuarioId) {
  if (!mongoose.isObjectIdOrHexString(usuarioId)) throw new TypeError("usuarioId inválido");
  const id = new mongoose.Types.ObjectId(String(usuarioId));
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const head = await ChainHead.findOne({ usuarioId: id }).session(session).lean();
      const registros = await DecisionProof.find({ usuarioId: id })
        .sort({ secuencia: 1, _id: 1 })
        .limit(MAX_REGISTROS + 1)
        .session(session).lean();
      if (registros.length > MAX_REGISTROS) {
        return { valida: false, codigo: "AUDITORIA_REQUIERE_PAGINACION", secuencia: null };
      }
      if (!head) {
        // No es posible distinguir una cuenta nueva de un borrado total
        // sin evidencia externa. Nunca certificar una cadena ausente.
        return registros.length === 0
          ? { valida: false, codigo: "SIN_ANCLA_DE_INTEGRIDAD", secuencia: 0 }
          : { valida: false, codigo: "HEAD_AUSENTE", secuencia: null };
      }
      // Un encabezado reiniciado (secuencia cero) no demuestra que nunca
      // hayan existido movimientos. Sin una prueba externa, no certificarlo.
      if (head.secuencia === 0 && registros.length === 0) {
        return { valida: false, codigo: "SIN_ANCLA_DE_INTEGRIDAD", secuencia: 0 };
      }
      return verificarCadena(registros, head, String(id));
    }, {
      readConcern: { level: "snapshot" },
      writeConcern: { w: "majority" },
      readPreference: "primary"
    });
  } finally {
    await session.endSession();
  }
}

module.exports = { auditarCadenaUsuario, MAX_REGISTROS };
