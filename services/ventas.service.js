"use strict";

const Venta = require("../models/Venta");
const eventBus = require("../core/eventos/eventBus");

async function registrarVentaDesdePedido({
  pedido,
  empresaId,
  sedeId = null
}) {
  if (!pedido) {
    throw new Error(
      "GRUK Ventas: pedido requerido para registrar la venta"
    );
  }

  if (!empresaId) {
    throw new Error(
      "GRUK Ventas: empresaId requerido para registrar la venta"
    );
  }

  try {
    const venta = await Venta.create({
      empresaId,
      sedeId,

      origen: "restaurante",
      origenId: pedido._id,

      concepto: pedido.producto,
      categoria: pedido.categoria || "",

      cantidad: 1,
      precioUnitario: pedido.precio,
      total: pedido.precio,

      metodoPago: pedido.metodoPago || "",

      estado: "pagada",

      metadata: {
        restaurantId: pedido.restaurantId,
        pedidoId: pedido._id.toString(),
        mesa: pedido.mesa
      }
    });

    eventBus.emit("VENTA_COMPLETADA", {
      ventaId: venta._id,
      empresaId: venta.empresaId,
      sedeId: venta.sedeId,
      origen: venta.origen,
      origenId: venta.origenId,
      total: venta.total,
      metodoPago: venta.metodoPago,
      fecha: venta.fecha
    });

    return {
      venta,
      creada: true
    };

  } catch (error) {
    // Idempotencia:
    // el mismo pedido nunca debe generar dos ventas.
    if (error && error.code === 11000) {
      const ventaExistente = await Venta.findOne({
        origen: "restaurante",
        origenId: pedido._id
      });

      return {
        venta: ventaExistente,
        creada: false
      };
    }

    throw error;
  }
}

module.exports = {
  registrarVentaDesdePedido
};
