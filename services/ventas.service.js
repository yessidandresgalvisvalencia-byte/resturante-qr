"use strict";

const mongoose = require("mongoose");
const Venta = require("../models/Venta");
const ProductoServicio = require("../models/ProductoServicio");
const Cliente = require("../models/Cliente");
const eventBus = require("../core/eventos/eventBus");
const { calculateLegacySale, canonicalLegacyMoney } = require("../core/finance/enterpriseSalesMath");

// Replay comparison must not coerce malformed historical amounts to a Number.
// Fail closed if either side cannot be represented as a canonical cent amount.
function sameLegacyMoney(a, b) {
  try {
    return canonicalLegacyMoney(a) === canonicalLegacyMoney(b);
  } catch {
    return false;
  }
}

async function registrarVentaDesdePedido({
  pedido,
  empresaId,
  sedeId = null,
  session = null,
  emitirEvento = true
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

  // Reject cross-tenant or cross-site order payloads before any database read.
  // Some legacy orders omit these fields; when supplied they must match the
  // authoritative sale scope, including the null-site case.
  if (pedido.empresaId != null && String(pedido.empresaId) !== String(empresaId)) {
    throw new Error("GRUK_VENTA_PEDIDO_TENANT_CONFLICT");
  }
  if (pedido.sedeId != null && String(pedido.sedeId) !== String(sedeId)) {
    throw new Error("GRUK_VENTA_PEDIDO_SEDE_CONFLICT");
  }

  // Validate untrusted customer identifiers before any database access.
  if (pedido.clienteId && !mongoose.Types.ObjectId.isValid(pedido.clienteId)) {
    throw new Error("GRUK Ventas: clienteId invalido");
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
        .session(session)
        .lean();

    if (!productoServicio) {
      throw new Error(
        "GRUK Ventas: ProductoServicio no pertenece a la empresa"
      );
    }

    let clienteId = null;

    if (pedido.clienteId) {
      const filtroCliente = {
        _id: pedido.clienteId,
        empresaId,
        sedeId: sedeId ?? null,
        deletedAt: null
      };

      const cliente = await Cliente.findOne(
        filtroCliente
      )
        .select("_id")
        .session(session)
        .lean();

      if (!cliente) {
        throw new Error(
          "GRUK Ventas: Cliente no pertenece a la empresa o sede"
        );
      }

      clienteId = cliente._id;
    }

    // P0-07: validate the legacy Number boundary and calculate in integer cents.
    // Mongo Venta still stores Number: this is NOT exact-ledger persistence.
    // Reject subcent, unsafe or fractional quantities rather than silently round.
    const cantidad = pedido.cantidad;
    const precioUnitario = pedido.precioUnitario;
    const total = pedido.precio;
    const costoUnitario = productoServicio.costoUnitario;
    const exact = calculateLegacySale({
      quantity: cantidad,
      unitPrice: precioUnitario,
      unitCost: costoUnitario,
      total
    });
    // Convert only at the legacy schema boundary; never calculate money in float.
    const costoTotal = Number(exact.costCents) / 100;
    const utilidadBruta = Number(exact.profitCents) / 100;
    const margenBruto = exact.marginBasisPoints === null
      ? 0
      : Number(exact.marginBasisPoints) / 100;

    const [venta] = await Venta.create([{
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
        // Immutable calculation evidence in canonical integer-cent strings.
        // Transitional audit snapshot only; legacy Venta money fields remain Number.
        calculoExactoV1: {
          ingresoCentavos: exact.revenueCents,
          brutoCentavos: exact.grossCents,
          descuentoCentavos: exact.discountCents,
          costoCentavos: exact.costCents,
          utilidadCentavos: exact.profitCents,
          margenPuntosBase: exact.marginBasisPoints
        },

        // Permite a la futura neurona distinguir
        // ventas nuevas con costo congelado de ventas
        // historicas cuyos ceros no son confiables.
        costoCongelado: costoUnitario > 0,
costoFuente:
  costoUnitario > 0
    ? "ProductoServicio"
    : "NO_CONFIGURADO"
      }
    }], { session });

    if (emitirEvento) eventBus.emit("VENTA_COMPLETADA", {
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
      const filtroExistente = {
        origen: "restaurante",
        origenId: pedido._id,
        empresaId,
        sedeId
      };
      const ventaExistente = await Venta.findOne(filtroExistente).session(session);
      if (!ventaExistente) throw error;
      // A duplicate order ID with different economic contents is a conflict,
      // not an idempotent replay. Never silently return a different sale.
      const sameSale = Number.isSafeInteger(ventaExistente.cantidad) &&
        ventaExistente.cantidad > 0 &&
        ventaExistente.cantidad === pedido.cantidad &&
        sameLegacyMoney(ventaExistente.precioUnitario, pedido.precioUnitario) &&
        sameLegacyMoney(ventaExistente.total, pedido.precio) &&
        String(ventaExistente.productoServicioId) === String(pedido.productoServicioId) &&
        String(ventaExistente.metodoPago || "") === String(pedido.metodoPago || "") &&
        String(ventaExistente.clienteId || "") === String(pedido.clienteId || "");
      // Cancelled or unpaid sales cannot satisfy a paid-order replay.
      if (ventaExistente.estado !== "pagada") {
        const conflict = new Error("GRUK_VENTA_REPLAY_STATE_CONFLICT");
        conflict.code = "GRUK_VENTA_REPLAY_STATE_CONFLICT";
        throw conflict;
      }
      if (!sameSale) {
        const conflict = new Error("GRUK_VENTA_REPLAY_CONFLICT");
        conflict.code = "GRUK_VENTA_REPLAY_CONFLICT";
        throw conflict;
      }

      return {
        venta: ventaExistente,
        creada: false
      };
    }

    throw error;
  }
}

function emitirVentaCompletada(venta) {
  eventBus.emit("VENTA_COMPLETADA", {
    ventaId: venta._id, empresaId: venta.empresaId, sedeId: venta.sedeId,
    productoServicioId: venta.productoServicioId, clienteId: venta.clienteId,
    origen: venta.origen, origenId: venta.origenId, cantidad: venta.cantidad,
    precioUnitario: venta.precioUnitario, total: venta.total,
    costoUnitario: venta.costoUnitario, costoTotal: venta.costoTotal,
    utilidadBruta: venta.utilidadBruta, margenBruto: venta.margenBruto,
    metodoPago: venta.metodoPago, concepto: venta.concepto, fecha: venta.fecha,
    sourceUpdatedAt: venta.updatedAt, cajaReferencia: venta.metadata?.cajaReferencia || null
  });
}

module.exports = { registrarVentaDesdePedido, emitirVentaCompletada };
