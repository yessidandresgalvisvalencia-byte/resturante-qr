"use strict";

const Gasto = require("../../models/Gasto");
const eventBus = require("../eventos/eventBus");

async function registrarGasto({
  empresaId,
  sedeId = null,
  concepto,
  categoria,
  monto,
  metodoPago = "",
  estadoPago = "desconocido",
  proveedor = "",
  fecha = new Date(),
  origen = "manual",
  metadata = {}
}) {
  /*
   * Regla de integridad:
   * primero Mongo confirma la persistencia.
   * Solo después existe GASTO_REGISTRADO.
   */
  const gasto = await Gasto.create({
    empresaId,
    sedeId: sedeId || null,
    concepto,
    categoria,
    monto,
    metodoPago,
    estadoPago,
    proveedor,
    fecha,
    origen,
    metadata
  });

  try {
    eventBus.emit("GASTO_REGISTRADO", {
      gastoId: gasto._id,
      empresaId: gasto.empresaId,
      sedeId: gasto.sedeId,
      concepto: gasto.concepto,
      categoria: gasto.categoria,
      monto: gasto.monto,
      metodoPago: gasto.metodoPago,
      estadoPago: gasto.estadoPago,
      proveedor: gasto.proveedor,
      fecha: gasto.fecha,
      origen: gasto.origen
    });
  } catch (error) {
    console.error(
      "GRUK Gastos: gasto persistido, fallo al emitir GASTO_REGISTRADO:",
      error
    );
  }

  return gasto;
}

module.exports = {
  registrarGasto
};
