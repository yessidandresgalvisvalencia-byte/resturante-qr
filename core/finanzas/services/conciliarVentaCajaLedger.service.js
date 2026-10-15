"use strict";
const mongoose = require("mongoose");
const Venta = require("../../../models/Venta");
const Caja = require("../models/MovimientoCaja");
const Ledger = require("../models/GrukLedgerV1");
const { copToMinor } = require("./copMinorUnits.service");

async function conciliarVentaCajaLedger({ empresaId, sedeId, ventaId, session } = {}) {
  if (![empresaId, sedeId, ventaId].every(mongoose.isValidObjectId)) {
    throw new Error("CONCILIACION_IDENTIDAD_INVALIDA");
  }
  const ventaQuery = Venta.findOne({ _id: ventaId, empresaId, sedeId });
  const venta = await (session ? ventaQuery.session(session) : ventaQuery).lean();
  if (!venta) return { conciliada: false, estado: "VENTA_NO_ENCONTRADA" };
  if (venta.estado !== "pagada") {
    return { conciliada: false, estado: "VENTA_NO_PAGADA" };
  }
  if (!mongoose.isValidObjectId(venta.origenId) ||
      !Number.isSafeInteger(venta.total) || venta.total <= 0) {
    return { conciliada: false, estado: "VENTA_LEGADA_INSEGURA" };
  }
  const cajaQuery = Caja.find({ empresaId, sedeId, origenTipo: "VENTA", origenId: ventaId,
    tipoAsiento: "CONFIRMACION", deletedAt: null });
  const ledgerQuery = Ledger.find({ empresaId, sedeId,
    claveIdempotencia: "venta:" + String(venta.origenId) });
  // MongoDB forbids parallel operations within a single transaction.
  const caja = await (session ? cajaQuery.session(session) : cajaQuery).lean();
  const ledger = await (session ? ledgerQuery.session(session) : ledgerQuery).lean();
  if (caja.length !== 1 || ledger.length !== 1) {
    return { conciliada: false, estado: "REGISTROS_INCOMPLETOS_O_DUPLICADOS",
      movimientosCaja: caja.length, asientosLedger: ledger.length };
  }
  const m = caja[0], a = ledger[0];
  const reversionQuery = Caja.exists({
    empresaId, sedeId, origenTipo: "VENTA", origenId: ventaId,
    tipoAsiento: "REVERSION", movimientoOriginalId: m._id, deletedAt: null
  });
  const reversion = await (session ? reversionQuery.session(session) : reversionQuery);
  if (reversion) {
    return { conciliada: false, estado: "VENTA_REVERSADA",
      movimientosCaja: 1, asientosLedger: 1 };
  }
  if (!Number.isSafeInteger(m.monto) || m.monto <= 0) {
    return { conciliada: false, estado: "MONTO_CAJA_INSEGURO" };
  }
  const esperado = copToMinor(String(venta.total));
  const cuentasPorMedio = Object.freeze({
    efectivo: "CAJA_EFECTIVO",
    tarjeta: "PAGOS_TARJETA_POR_CONCILIAR",
    transferencia: "TRANSFERENCIAS_POR_CONCILIAR"
  });
  const medioVenta = typeof venta.metodoPago === "string"
    ? venta.metodoPago.trim().toLowerCase() : "";
  const medioCaja = typeof m.metodoPago === "string"
    ? m.metodoPago.trim().toLowerCase() : "";
  if (!Object.hasOwn(cuentasPorMedio, medioVenta)) {
    return { conciliada: false, estado: "MEDIO_PAGO_NO_VERIFICABLE" };
  }
  if (medioCaja && medioCaja !== medioVenta) {
    return { conciliada: false, estado: "MEDIO_PAGO_INCONSISTENTE" };
  }
  if (a.cuenta !== cuentasPorMedio[medioVenta]) {
    return { conciliada: false, estado: "CUENTA_LEDGER_INCONSISTENTE" };
  }
  const conciliada = copToMinor(String(m.monto)) === esperado &&
    a.montoMenor === esperado && m.direccion === "ENTRADA" &&
    m.moneda === "COP" && a.moneda === "COP" && a.tipo === "ABONO";
  return { conciliada, estado: conciliada ? "CONCILIADA" : "DIFERENCIA",
    movimientosCaja: 1, asientosLedger: 1 };
}
async function conciliarVentaCajaLedgerSnapshot(ids = {}) {
  if (![ids.empresaId, ids.sedeId, ids.ventaId].every(mongoose.isValidObjectId)) {
    throw new Error("CONCILIACION_IDENTIDAD_INVALIDA");
  }
  const session = await mongoose.startSession();
  try {
    let resultado;
    await session.withTransaction(async () => {
      resultado = await conciliarVentaCajaLedger({ ...ids, session });
    }, {
      readConcern: { level: "snapshot" },
      writeConcern: { w: "majority" },
      readPreference: "primary"
    });
    return { ...resultado, consistencia: "SNAPSHOT" };
  } finally {
    await session.endSession();
  }
}
module.exports = { conciliarVentaCajaLedger, conciliarVentaCajaLedgerSnapshot };
