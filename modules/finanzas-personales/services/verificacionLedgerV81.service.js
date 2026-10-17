"use strict";
const mongoose = require("mongoose");
const Evento = require("../models/eventoV81.model");
const Cabeza = require("../models/cabezaV81.model");
const { GENESIS, verificarCadena } = require("./cadenaEventosV81.service");

// Auditoría de solo lectura. Nunca repara ni recalcula la cabeza automáticamente.
async function verificarLedgerPersistidoV81(usuarioId) {
  if (!mongoose.isValidObjectId(usuarioId)) throw new TypeError("Usuario inválido");
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const cabeza = await Cabeza.findOne({usuarioId}).session(session).lean();
      const rows = await Evento.find({usuarioId}).sort({version:1}).session(session).lean();
      if (!cabeza) return {integridad: rows.length === 0 ? "SIN_INICIALIZAR" : "FALLIDA", cantidad: rows.length};
      if (cabeza.version === 0 && cabeza.hashActual === GENESIS && rows.length === 0) {
        return {integridad:"SIN_MOVIMIENTOS", cantidad:0};
      }
      if (rows.length !== cabeza.version) return {integridad:"FALLIDA", cantidad:rows.length};
      let eventos;
      try { eventos = rows.map(e => ({
        id:e.eventId,userId:String(e.usuarioId),version:e.version,tipo:e.tipo,
        montoCentavos:BigInt(e.montoCentavos),fechaContable:e.fechaContable,
        timestamp:e.timestamp,corrigeId:e.corrigeId,motivo:e.motivo,
        tipoCorregido:e.tipoCorregido,hashAnterior:e.hashAnterior,hashActual:e.hashActual
      })); } catch (_) { return {integridad:"FALLIDA",cantidad:rows.length}; }
      return {integridad:verificarCadena(eventos,cabeza.hashActual)?"VERIFICADA":"FALLIDA",cantidad:rows.length};
    }, {readConcern:{level:"snapshot"},readPreference:"primary"});
  } finally {await session.endSession();}
}
module.exports={verificarLedgerPersistidoV81};
