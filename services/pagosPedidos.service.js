"use strict";
const mongoose = require("mongoose");
const Pedido = require("../models/pedido");
const Restaurante = require("../models/restaurante");
const Sede = require("../models/sede");
const IntentoPagoPedido = require("../models/IntentoPagoPedido");
const { registrarVentaDesdePedido, emitirVentaCompletada } = require("./ventas.service");
const { validarPedidosIntento } = require("./gruk/validarPedidosIntento");
const { totalPedidoCopEnCentavos } = require("./gruk/totalPedidoCopEnCentavos");
const { registrarVentaEnOutbox } = require("./gruk/registrarVentaEnOutbox");
const { resolverOutboxWompi } = require("./gruk/resolverOutboxWompi");

async function confirmarPagoPedidoWompi({ transaction, io = null, outboxWriter = null, env = process.env }) {
  const writer = resolverOutboxWompi({ env, registrarEventoEnTransaccion: outboxWriter });
  const reference = String(transaction?.reference || "");
  if (!reference.startsWith("GRUK_PEDIDO_")) return { handled: false };

  const intento = await IntentoPagoPedido.findOne({ reference });
  if (!intento) return { handled: true, ok: false, reason: "INTENTO_NO_ENCONTRADO" };

  const amountOk = Number.isSafeInteger(transaction.amount_in_cents) &&
    transaction.amount_in_cents > 0 &&
    Number.isSafeInteger(intento.amountInCents) &&
    transaction.amount_in_cents === intento.amountInCents;
  const currencyOk = String(transaction.currency || "").toUpperCase() === intento.currency;
  if (!amountOk || !currencyOk) {
    console.error("[SEGURIDAD] Pago de pedido con monto/moneda inconsistente", { reference, transactionId: transaction.id });
    return { handled: true, ok: false, reason: "INTEGRIDAD_ECONOMICA_INVALIDA" };
  }

  const transactionId = String(transaction?.id || "").trim();
  // La referencia, el importe y la moneda no identifican por sí solos
  // un movimiento individual del proveedor de pagos.
  if (!transactionId || (intento.transactionId && intento.transactionId !== transactionId)) {
    return { handled: true, ok: false, reason: "IDENTIDAD_TRANSACCION_INVALIDA" };
  }

  const status = String(transaction.status || "").toUpperCase();
  // Un webhook tardío PENDING/DECLINED nunca revierte un pago ya aprobado.
  // La protección concurrente definitiva debe ser una escritura condicional ACID.
  if (intento.estado === "APROBADO") {
    return { handled: true, ok: true, estado: "APROBADO", idempotent: true };
  }
  if (status !== "APPROVED") {
    if (!["PENDING", "DECLINED", "ERROR", "VOIDED"].includes(status)) {
      return { handled: true, ok: false, reason: "ESTADO_PROVEEDOR_INVALIDO" };
    }
    const estadoNuevo = status === "PENDING" ? "PENDIENTE" : "RECHAZADO";
    // Una notificación PENDING fuera de orden no puede reabrir un rechazo.
    if (estadoNuevo === "PENDIENTE" && intento.estado === "RECHAZADO") {
      return { handled: true, ok: true, estado: "RECHAZADO", idempotent: true };
    }
    const updated = await IntentoPagoPedido.findOneAndUpdate(
      {
        reference,
        estado: estadoNuevo === "PENDIENTE"
          ? { $in: ["CREADO", "PENDIENTE"] }
          : { $ne: "APROBADO" },
        transactionId: { $in: ["", transactionId] }
      },
      { $set: {
        estado: estadoNuevo,
        transactionId: String(transaction.id || ""),
        ...(estadoNuevo === "RECHAZADO" ? { resueltoAt: new Date() } : {})
      } },
      { new: true }
    );
    if (!updated) {
      const current = await IntentoPagoPedido.findOne({ reference });
      if (current?.transactionId && current.transactionId !== transactionId) {
        return { handled: true, ok: false, reason: "IDENTIDAD_TRANSACCION_INVALIDA" };
      }
      if (current?.estado === "APROBADO") {
        return { handled: true, ok: true, estado: "APROBADO", idempotent: true };
      }
      if (estadoNuevo === "PENDIENTE" && current?.estado === "RECHAZADO") {
        return { handled: true, ok: true, estado: "RECHAZADO", idempotent: true };
      }
      return { handled: true, ok: false, reason: "INTENTO_NO_ENCONTRADO" };
    }
    return { handled: true, ok: true, estado: updated.estado };
  }

  if (intento.estado === "APROBADO") {
    return { handled: true, ok: true, estado: "APROBADO", idempotent: true };
  }

  const session = await mongoose.startSession();
  const ventasPostCommit = [];
  const pedidosPostCommit = [];
  try {
    await session.withTransaction(async () => {
      // withTransaction puede ejecutar este callback varias veces ante errores transitorios.
      // Conservar solo los eventos correspondientes al intento que realmente confirme.
      ventasPostCommit.length = 0;
      pedidosPostCommit.length = 0;
      const lockedIntento = await IntentoPagoPedido.findOne({ reference }).session(session);
      if (!lockedIntento) throw new Error("INTENTO_NO_ENCONTRADO");
      // Revalidar bajo la misma snapshot transaccional usada para marcar la venta.
      // La lectura previa al inicio de sesión no es garantía ante concurrencia.
      if (
        lockedIntento.transactionId &&
        lockedIntento.transactionId !== transactionId
      ) {
        throw new Error("IDENTIDAD_TRANSACCION_INVALIDA");
      }
      if (
        !Number.isSafeInteger(lockedIntento.amountInCents) ||
        !Number.isSafeInteger(transaction.amount_in_cents) ||
        lockedIntento.amountInCents !== transaction.amount_in_cents ||
        String(lockedIntento.currency).toUpperCase() !== String(transaction.currency || "").toUpperCase()
      ) {
        throw new Error("INTEGRIDAD_ECONOMICA_INVALIDA");
      }
      if (lockedIntento.estado === "APROBADO") return;

      const restaurante = await Restaurante.findOne({ restaurantId: lockedIntento.restaurantId })
        .select("_id empresaId").session(session).lean();
      if (!restaurante?.empresaId) throw new Error("RESTAURANTE_SIN_EMPRESA");

      validarPedidosIntento(lockedIntento.pedidoIds);
      const pedidos = await Pedido.find({
        _id: { $in: lockedIntento.pedidoIds },
        restaurantId: lockedIntento.restaurantId
      }).session(session);

      if (pedidos.length !== lockedIntento.pedidoIds.length) throw new Error("PEDIDOS_INCOMPLETOS");

      const totalActual = totalPedidoCopEnCentavos(pedidos.map(p => p.precio));
      if (!Number.isSafeInteger(lockedIntento.amountInCents) ||
          totalActual !== lockedIntento.amountInCents) throw new Error("MONTO_PEDIDOS_CAMBIO");

      for (const pedido of pedidos) {
        if (pedido.estadoPago === "pagado") continue;

        let sedeObjectId = null;
        if (pedido.sedeId) {
          const sede = await Sede.findOne({
            empresaId: restaurante.empresaId,
            restauranteId: pedido.restaurantId,
            $or: [
              { codigoSede: pedido.sedeId },
              { _id: mongoose.Types.ObjectId.isValid(pedido.sedeId) ? pedido.sedeId : null }
            ]
          }).select("_id").session(session).lean();
          if (sede) sedeObjectId = sede._id;
        }

        const resultado = await registrarVentaDesdePedido({
          pedido,
          empresaId: restaurante.empresaId,
          sedeId: sedeObjectId,
          metodoPagoConfirmado: "tarjeta",
          session,
          emitirEvento: false
        });
        pedido.estadoPago = "pagado";
        pedido.metodoPago = "tarjeta";
        await pedido.save({ session });
        pedidosPostCommit.push(pedido);
        if (resultado.creada) {
          if (writer) {
            await registrarVentaEnOutbox({ venta: resultado.venta, session, registrarEventoEnTransaccion: writer });
          } else {
            ventasPostCommit.push(resultado.venta);
          }
        }
      }

      lockedIntento.estado = "APROBADO";
      lockedIntento.transactionId = String(transaction.id);
      lockedIntento.resueltoAt = new Date();
      await lockedIntento.save({ session });
    });

    for (const venta of ventasPostCommit) emitirVentaCompletada(venta);
    if (io) for (const pedido of pedidosPostCommit) io.emit("pedido:actualizado", pedido);
    return { handled: true, ok: true, estado: "APROBADO" };
  } finally {
    await session.endSession();
  }
}

module.exports = { confirmarPagoPedidoWompi };
