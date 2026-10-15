"use strict";

const mongoose = require("mongoose");
const { registrarVentaDesdePedido } = require("../../../services/ventas.service");
const { registrarMovimiento } = require("./ledgerAppend.service");
const { copToMinor } = require("./copMinorUnits.service");

async function registrarVentaConLedger({
  pedido, empresaId, sedeId, actorId, ip, claveIdempotencia, cuenta = "CAJA",
  session
} = {}) {
  if (!session || !session.inTransaction() ||
      session.client !== mongoose.connection.getClient()) {
    throw new Error("VENTA_LEDGER_TRANSACCION_REQUERIDA");
  }
  if (!mongoose.isValidObjectId(empresaId) ||
      !mongoose.isValidObjectId(sedeId) ||
      !mongoose.isValidObjectId(actorId)) {
    throw new Error("VENTA_LEDGER_IDENTIDAD_INVALIDA");
  }
  if (!pedido || !mongoose.isValidObjectId(pedido._id) ||
      typeof pedido.precio !== "string") {
    throw new Error("VENTA_LEDGER_PEDIDO_INVALIDO");
  }
  if (typeof claveIdempotencia !== "string" ||
      claveIdempotencia !== "venta:" + String(pedido._id)) {
    throw new Error("VENTA_LEDGER_IDEMPOTENCIA_PEDIDO_INVALIDA");
  }
  const montoMenor = copToMinor(pedido.precio);
  if (!/^(0|[1-9][0-9]*)$/.test(pedido.precio) ||
      BigInt(pedido.precio) > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("VENTA_LEDGER_PRECIO_LEGADO_INSEGURO");
  }
  if (montoMenor === "0") throw new Error("VENTA_LEDGER_MONTO_CERO");
  const resultado = await registrarVentaDesdePedido({
    pedido, empresaId, sedeId, session, emitirEvento: false
  });
  const asiento = await registrarMovimiento({
    empresaId, sedeId, actorId, ip, cuenta,
    tipo: "ABONO", montoMenor, claveIdempotencia
  }, { session });
  if (resultado.creada !== asiento.creado) {
    throw new Error("VENTA_LEDGER_ESTADO_INCONSISTENTE");
  }
  return { venta: resultado.venta, movimiento: asiento.movimiento, creada: resultado.creada };
}

module.exports = { registrarVentaConLedger };
