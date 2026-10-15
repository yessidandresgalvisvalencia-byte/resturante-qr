"use strict";
const mongoose = require("mongoose");
const Venta = require("../../../models/Venta");
const Caja = require("../models/MovimientoCaja");
const Ledger = require("../models/GrukLedgerV1");
const { copToMinor } = require("./copMinorUnits.service");

async function conciliarVentaCajaLedger({ empresaId, sedeId, ventaId } = {}) {
  if (![empresaId, sedeId, ventaId].every(mongoose.isValidObjectId)) {
    throw new Error("CONCILIACION_IDENTIDAD_INVALIDA");
  }
  const venta = await Venta.findOne({ _id: ventaId, empresaId, sedeId }).lean();
  if (!venta) return { conciliada: false, estado: "VENTA_NO_ENCONTRADA" };
  if (!mongoose.isValidObjectId(venta.origenId) ||
      !Number.isSafeInteger(venta.total) || venta.total <= 0) {
    return { conciliada: false, estado: "VENTA_LEGADA_INSEGURA" };
  }
  const [caja, ledger] = await Promise.all([
    Caja.find({ empresaId, sedeId, origenTipo: "VENTA", origenId: ventaId,
      tipoAsiento: "CONFIRMACION", deletedAt: null }).lean(),
    Ledger.find({ empresaId, sedeId,
      claveIdempotencia: "venta:" + String(venta.origenId) }).lean()
  ]);
  if (caja.length !== 1 || ledger.length !== 1) {
    return { conciliada: false, estado: "REGISTROS_INCOMPLETOS_O_DUPLICADOS",
      movimientosCaja: caja.length, asientosLedger: ledger.length };
  }
  const m = caja[0], a = ledger[0];
  if (!Number.isSafeInteger(m.monto) || m.monto <= 0) {
    return { conciliada: false, estado: "MONTO_CAJA_INSEGURO" };
  }
  const esperado = copToMinor(String(venta.total));
  const conciliada = copToMinor(String(m.monto)) === esperado &&
    a.montoMenor === esperado && m.direccion === "ENTRADA" &&
    m.moneda === "COP" && a.moneda === "COP" && a.tipo === "ABONO";
  return { conciliada, estado: conciliada ? "CONCILIADA" : "DIFERENCIA",
    movimientosCaja: 1, asientosLedger: 1 };
}
module.exports = { conciliarVentaCajaLedger };
