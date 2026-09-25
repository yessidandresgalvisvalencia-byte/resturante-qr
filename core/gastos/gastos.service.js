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
  fechaVencimientoPago = null,
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
    fechaVencimientoPago:
      fechaVencimientoPago || null,
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
      fechaVencimientoPago:
        gasto.fechaVencimientoPago,
      proveedor: gasto.proveedor,
      fecha: gasto.fecha,
      origen: gasto.origen,
      sourceUpdatedAt: gasto.updatedAt,
      cajaReferencia:
        gasto.metadata?.cajaReferencia || null
    });
  } catch (error) {
    console.error(
      "GRUK Gastos: gasto persistido, fallo al emitir GASTO_REGISTRADO:",
      error
    );
  }

  return gasto;
}

async function actualizarEstadoPagoGasto({
  gastoId,
  empresaId,
  sedeId = null,
  estadoPago
}) {
  const filtro = {
    _id: gastoId,
    empresaId,
    estado: "registrado"
  };

  if (sedeId) {
    filtro.sedeId = sedeId;
  }

  const gasto = await Gasto.findOne(
    filtro
  );

  if (!gasto) {
    const error = new Error(
      "GASTO_NO_ENCONTRADO"
    );
    error.statusCode = 404;
    throw error;
  }

  const anterior =
    gasto.estadoPago ||
    "desconocido";

  if (anterior === estadoPago) {
    return gasto;
  }

  gasto.estadoPago = estadoPago;
  await gasto.save();

  try {
    eventBus.emit(
      "GASTO_PAGO_ACTUALIZADO",
      {
        gastoId: gasto._id,
        empresaId: gasto.empresaId,
        sedeId: gasto.sedeId,
        concepto: gasto.concepto,
        categoria: gasto.categoria,
        monto: gasto.monto,
        metodoPago: gasto.metodoPago,
        estadoPagoAnterior: anterior,
        estadoPago: gasto.estadoPago,
        fechaVencimientoPago:
          gasto.fechaVencimientoPago,
        proveedor: gasto.proveedor,
        fecha: gasto.fecha,
        origen: gasto.origen,
        sourceUpdatedAt:
          gasto.updatedAt,
        cajaReferencia:
          gasto.metadata?.cajaReferencia || null
      }
    );
  } catch (error) {
    console.error(
      "GRUK Gastos: estado de pago persistido, fallo al emitir GASTO_PAGO_ACTUALIZADO:",
      error
    );
  }

  return gasto;
}

module.exports = {
  registrarGasto,
  actualizarEstadoPagoGasto
};
