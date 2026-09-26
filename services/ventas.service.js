"use strict";

const mongoose = require("mongoose");
const Venta = require("../models/Venta");
const ProductoServicio = require("../models/ProductoServicio");
const Cliente = require("../models/Cliente");
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
    if (!pedido.productoServicioId) {
      throw new Error(
        "GRUK Ventas: pedido sin productoServicioId"
      );
    }

    // Seguridad multi-tenant:
    // no basta conocer el _id del producto; también debe
    // pertenecer a la misma empresa de la venta.
    const productoServicio =
      await ProductoServicio.findOne({
        _id: pedido.productoServicioId,
        empresaId
      })
        .select("_id costoUnitario")
        .lean();

    if (!productoServicio) {
      throw new Error(
        "GRUK Ventas: ProductoServicio no pertenece a la empresa"
      );
    }

    let clienteId = null;

    if (pedido.clienteId) {
      if (
        !mongoose.Types.ObjectId.isValid(
          pedido.clienteId
        )
      ) {
        throw new Error(
          "GRUK Ventas: clienteId invalido"
        );
      }

      const filtroCliente = {
        _id: pedido.clienteId,
        empresaId,
        deletedAt: null
      };

      if (sedeId) {
        filtroCliente.sedeId = sedeId;
      }

      const cliente = await Cliente.findOne(
        filtroCliente
      )
        .select("_id")
        .lean();

      if (!cliente) {
        throw new Error(
          "GRUK Ventas: Cliente no pertenece a la empresa o sede"
        );
      }

      clienteId = cliente._id;
    }

    const cantidad = Number(pedido.cantidad);
    const precioUnitario = Number(
      pedido.precioUnitario
    );
    const total = Number(pedido.precio);
    const costoUnitario = Number(
      productoServicio.costoUnitario
    );

    if (
      !Number.isFinite(cantidad) ||
      cantidad <= 0 ||
      !Number.isFinite(precioUnitario) ||
      precioUnitario < 0 ||
      !Number.isFinite(total) ||
      total < 0 ||
      !Number.isFinite(costoUnitario) ||
      costoUnitario < 0
    ) {
      throw new Error(
        "GRUK Ventas: datos economicos invalidos"
      );
    }

    const costoTotal =
      costoUnitario * cantidad;

    const utilidadBruta =
      total - costoTotal;

    const margenBruto =
      total > 0
        ? (utilidadBruta / total) * 100
        : 0;

    const venta = await Venta.create({
      empresaId,
      sedeId,

      productoServicioId:
        productoServicio._id,

      clienteId,

      origen: "restaurante",
      origenId: pedido._id,

      concepto: pedido.producto,
      categoria: pedido.categoria || "",

      cantidad,
      precioUnitario,
      costoUnitario,
      costoTotal,
      utilidadBruta,
      margenBruto,
      total,

      metodoPago: pedido.metodoPago || "",

      estado: "pagada",

      metadata: {
        restaurantId: pedido.restaurantId,
        pedidoId: pedido._id.toString(),
        mesa: pedido.mesa,

        // Permite a la futura neurona distinguir
        // ventas nuevas con costo congelado de ventas
        // historicas cuyos ceros no son confiables.
        costoCongelado: costoUnitario > 0,
costoFuente:
  costoUnitario > 0
    ? "ProductoServicio"
    : "NO_CONFIGURADO"
      }
    });

    eventBus.emit("VENTA_COMPLETADA", {
      ventaId: venta._id,
      empresaId: venta.empresaId,
      sedeId: venta.sedeId,

      productoServicioId:
        venta.productoServicioId,

      clienteId: venta.clienteId,

      origen: venta.origen,
      origenId: venta.origenId,

      cantidad: venta.cantidad,
      precioUnitario: venta.precioUnitario,
      total: venta.total,

      costoUnitario: venta.costoUnitario,
      costoTotal: venta.costoTotal,
      utilidadBruta: venta.utilidadBruta,
      margenBruto: venta.margenBruto,

      metodoPago: venta.metodoPago,
      concepto: venta.concepto,
      fecha: venta.fecha,
      sourceUpdatedAt: venta.updatedAt,
      cajaReferencia:
        venta.metadata?.cajaReferencia || null
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
