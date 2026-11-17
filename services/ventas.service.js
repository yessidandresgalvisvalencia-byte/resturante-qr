"use strict";

const mongoose = require("mongoose");
const Venta = require("../models/Venta");
const ProductoServicio = require("../models/ProductoServicio");
const Cliente = require("../models/Cliente");
const eventBus = require("../core/eventos/eventBus");

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

  // Tenant context must be a valid persisted identity before any lookup.
  if (!mongoose.Types.ObjectId.isValid(empresaId)) {
    throw new Error("GRUK Ventas: empresaId invalido");
  }
  if (sedeId != null && !mongoose.Types.ObjectId.isValid(sedeId)) {
    throw new Error("GRUK Ventas: sedeId invalido");
  }

  let creandoVenta = false;
  // The duplicate-key recovery runs in catch and needs the frozen values.
  let costoUnitario;
  let costoTotal;
  try {
    // Reject a caller-supplied order whose tenant or branch conflicts with the
    // sale context before any database lookup or write. Legacy orders may omit
    // these fields; absence is not evidence of authorization at the endpoint.
    if (pedido.empresaId != null && String(pedido.empresaId) !== String(empresaId)) {
      throw new Error("GRUK Ventas: pedido de otra empresa");
    }
    if (pedido.sedeId != null && String(pedido.sedeId) !== String(sedeId)) {
      throw new Error("GRUK Ventas: pedido de otra sede");
    }
    // A persisted source identity is mandatory for idempotent sale registration.
    if (!pedido._id || !mongoose.Types.ObjectId.isValid(pedido._id)) {
      throw new Error("GRUK Ventas: pedidoId invalido");
    }
    if (!pedido.productoServicioId) {
      throw new Error(
        "GRUK Ventas: pedido sin productoServicioId"
      );
    }
    if (!mongoose.Types.ObjectId.isValid(pedido.productoServicioId)) {
      throw new Error("GRUK Ventas: productoServicioId invalido");
    }

    // Reject malformed customer identity before querying any tenant data.
    if (pedido.clienteId && !mongoose.Types.ObjectId.isValid(pedido.clienteId)) {
      throw new Error("GRUK Ventas: clienteId invalido");
    }

    // Seguridad multi-tenant:
    // no basta conocer el _id del producto; también debe
    // pertenecer a la misma empresa de la venta.
    const productoServicio =
      await ProductoServicio.findOne({
        _id: pedido.productoServicioId,
        empresaId,
        // Productos globales (sedeId null) o de esta sede; nunca de otra.
        sedeId: sedeId == null ? null : { $in: [sedeId, null] }
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
        deletedAt: null
      };

      // Sin sede explícita, únicamente clientes globales: nunca de otra sede.
      filtroCliente.sedeId = sedeId == null ? null : sedeId;

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

    // Number(null) and Number('') both yield zero. Missing monetary inputs
    // must not silently become valid zero-value paid sales.
    for (const [campo, valor] of [
      ["cantidad", pedido.cantidad],
      ["precioUnitario", pedido.precioUnitario],
      ["precio", pedido.precio],
      ["costoUnitario", productoServicio.costoUnitario]
    ]) {
      if (typeof valor !== "number" && (typeof valor !== "string" || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(valor.trim()))) {
        throw new Error("GRUK Ventas: datos economicos invalidos");
      }
    }

    // Prevent tiny nonzero decimal strings from silently underflowing to zero.
    // This is a fail-closed input guard, not a replacement for decimal arithmetic.
    for (const valor of [pedido.precioUnitario, pedido.precio, productoServicio.costoUnitario]) {
      if (typeof valor === "string" && Number(valor) === 0 &&
          /[1-9]/.test(valor.replace(/^[+-]?0*\\.?0*/, ""))) {
        throw new Error("GRUK Ventas: precision economica insuficiente");
      }
    }

    const cantidad = Number(pedido.cantidad);
    const precioUnitario = Number(
      pedido.precioUnitario
    );
    const total = Number(pedido.precio);
    costoUnitario = Number(
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

    // Reject integers that JavaScript cannot represent exactly. This is a
    // fail-closed guard, NOT a substitute for the future decimal ledger.
    if ([cantidad, precioUnitario, total, costoUnitario].some(
      (valor) => Number.isInteger(valor) && !Number.isSafeInteger(valor)
    )) {
      throw new Error("GRUK Ventas: datos economicos fuera de rango seguro");
    }

    costoTotal =
      costoUnitario * cantidad;

    const utilidadBruta =
      total - costoTotal;

    const margenBruto =
      total > 0
        ? (utilidadBruta / total) * 100
        : 0;

    // Guard derived monetary values as well as inputs. Safe integer inputs
    // can overflow when multiplied or subtracted; never persist such totals.
    if (!Number.isFinite(costoTotal) || !Number.isFinite(utilidadBruta) ||
        !Number.isFinite(margenBruto) ||
        [costoTotal, utilidadBruta].some(
          (valor) => Number.isInteger(valor) && !Number.isSafeInteger(valor)
        )) {
      throw new Error("GRUK Ventas: calculos economicos fuera de rango seguro");
    }

    creandoVenta = true;
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

    // Only Venta.create duplicate-key errors may trigger idempotent recovery.
    // A downstream event handler failure must propagate as-is after creation.
    creandoVenta = false;
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
    if (creandoVenta && error && error.code === 11000) {
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
      const sameSale = Number(ventaExistente.cantidad) === Number(pedido.cantidad) &&
        Number(ventaExistente.precioUnitario) === Number(pedido.precioUnitario) &&
        Number(ventaExistente.total) === Number(pedido.precio) &&
        // A replay must preserve the frozen unit cost and resulting total.
        Number(ventaExistente.costoUnitario) === costoUnitario &&
        Number(ventaExistente.costoTotal) === costoTotal &&
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
