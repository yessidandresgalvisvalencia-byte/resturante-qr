"use strict";
const mongoose = require("mongoose");
const Pedido = require("../models/pedido");
const Restaurante = require("../models/restaurante");
const Sede = require("../models/sede");
const IntentoPagoPedido = require("../models/IntentoPagoPedido");
const { registrarVentaDesdePedido, emitirVentaCompletada } = require("./ventas.service");
const { calcularImportePagoCentavos } = require("./p0/calcularImportePago");
const { registrarEventoEnTransaccion } = require("./p0/outbox.service");
const { isP0PedidoEnabled } = require("./p0/pedidoFeatureFlag");

async function confirmarPagoPedidoWompi({ transaction, io = null, conciliacionToken = null }) {
  const reference = String(transaction?.reference || "");
  if (!reference.startsWith("GRUK_PEDIDO_")) return { handled: false };

  const intento = await IntentoPagoPedido.findOne({ reference });
  if (!intento) return { handled: true, ok: false, reason: "INTENTO_NO_ENCONTRADO" };

  const amountOk = Number.isSafeInteger(transaction.amount_in_cents) && transaction.amount_in_cents > 0 && transaction.amount_in_cents === intento.amountInCents;
  const currencyOk = String(transaction.currency || "").toUpperCase() === intento.currency;
  if (!amountOk || !currencyOk) {
    console.error("[SEGURIDAD] Pago de pedido con monto/moneda inconsistente", { reference, transactionId: transaction.id });
    return { handled: true, ok: false, reason: "INTEGRIDAD_ECONOMICA_INVALIDA" };
  }

  const status = String(transaction.status || "").toUpperCase();
  if (typeof transaction.id !== "string" || !transaction.id.trim()) return { handled: true, ok: false, reason: "TRANSACCION_ID_INVALIDO" };
  if (!["PENDING","APPROVED","DECLINED","ERROR","VOIDED"].includes(status)) return { handled: true, ok: false, reason: "ESTADO_WOMPI_DESCONOCIDO" };
  if (intento.transactionId && String(intento.transactionId) !== transaction.id) return { handled: true, ok: false, reason: "TRANSACCION_REFERENCIA_CONFLICTIVA" };
  // A settled payment is final: delayed PENDING/DECLINED events must never revert it.
  if (intento.estado === "APROBADO") {
    if (String(intento.transactionId || "") !== String(transaction.id || "")) {
      return { handled: true, ok: false, reason: "TRANSACCION_APROBADA_DIFERENTE" };
    }
    return { handled: true, ok: true, estado: "APROBADO", idempotent: true };
  }
  if (status !== "APPROVED") {
    // Conditional atomic update prevents an older webhook from overwriting
    // an APPROVED payment committed after our initial read.
    const nuevoEstado = status === "PENDING" ? "PENDIENTE" : "RECHAZADO";
    const cambios = { estado: nuevoEstado, transactionId: transaction.id };
    if (nuevoEstado === "RECHAZADO") cambios.resueltoAt = new Date();
    const updated = await IntentoPagoPedido.findOneAndUpdate({
      reference,
      estado: { $ne: "APROBADO" },
      $or: [{ transactionId: transaction.id }, { transactionId: "" }, { transactionId: null }]
    }, { $set: cambios }, { new: true });
    if (updated) return { handled: true, ok: true, estado: updated.estado };
    const current = await IntentoPagoPedido.findOne({ reference }).lean();
    if (current?.estado === "APROBADO" && current.transactionId === transaction.id)
      return { handled: true, ok: true, estado: "APROBADO", idempotent: true };
    return { handled: true, ok: false, reason: current?.transactionId && current.transactionId !== transaction.id
      ? "TRANSACCION_REFERENCIA_CONFLICTIVA" : "INTENTO_ESTADO_CONFLICTIVO" };
  }

  if (intento.estado === "APROBADO") {
    return { handled: true, ok: true, estado: "APROBADO", idempotent: true };
  }

  const session = await mongoose.startSession();
  const ventasPostCommit = [];
  const pedidosPostCommit = [];
  let empresaNotificacionId = null;
  const outboxEnabled = isP0PedidoEnabled({restaurantId:intento.restaurantId});
  try {
    await session.withTransaction(async () => {
      // MongoDB can re-run this callback after transient errors. Discard effects from rolled-back attempts.
      ventasPostCommit.length = 0;
      pedidosPostCommit.length = 0;
      empresaNotificacionId = null;
      const lockedIntento = await IntentoPagoPedido.findOne({ reference }).session(session);
      if (!lockedIntento) throw new Error("INTENTO_NO_ENCONTRADO");
      if (lockedIntento.estado === "APROBADO") {
        if (String(lockedIntento.transactionId || "") !== String(transaction.id || "")) throw new Error("TRANSACCION_APROBADA_DIFERENTE");
        return;
      }
      // Reconciliation must retain ownership inside the settlement transaction.
      // Concurrent lease takeover changes this document and causes a Mongo write conflict.
      if (conciliacionToken !== null && (
        typeof conciliacionToken !== "string" ||
        !conciliacionToken ||
        lockedIntento.conciliacionToken !== conciliacionToken ||
        !(lockedIntento.conciliacionLeaseUntil instanceof Date) ||
        lockedIntento.conciliacionLeaseUntil <= new Date()
      )) throw new Error("CONCILIACION_RESERVA_PERDIDA");
      // The same payment reference cannot be settled by a different gateway transaction.
      if (lockedIntento.transactionId && String(lockedIntento.transactionId) !== String(transaction.id || "")) throw new Error("TRANSACCION_REFERENCIA_CONFLICTIVA");

      const restaurante = await Restaurante.findOne({ restaurantId: lockedIntento.restaurantId })
        .select("_id empresaId").session(session).lean();
      if (!restaurante?.empresaId) throw new Error("RESTAURANTE_SIN_EMPRESA");
      empresaNotificacionId = String(restaurante.empresaId);

      const pedidos = await Pedido.find({
        _id: { $in: lockedIntento.pedidoIds },
        restaurantId: lockedIntento.restaurantId
      }).session(session);

      if (pedidos.length !== lockedIntento.pedidoIds.length) throw new Error("PEDIDOS_INCOMPLETOS");

      const totalActual = calcularImportePagoCentavos(pedidos);
      if (totalActual !== Number(lockedIntento.amountInCents)) throw new Error("MONTO_PEDIDOS_CAMBIO");

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
          session,
          emitirEvento: false,
          metodoPagoConfirmado: 'tarjeta'
        });
        pedido.estadoPago = "pagado";
        pedido.metodoPago = "tarjeta";
        await pedido.save({ session });
        pedidosPostCommit.push(pedido);
        if (resultado.creada) {
          if (outboxEnabled) {
            await registrarEventoEnTransaccion({
              eventId: 'VENTA_COMPLETADA:'+String(resultado.venta._id),
              empresaId: restaurante.empresaId,
              sedeId: sedeObjectId,
              eventName: 'VENTA_COMPLETADA',
              aggregateId: resultado.venta._id,
              payload: {
                ventaId: String(resultado.venta._id),
                pedidoId: String(pedido._id),
                restaurantId: lockedIntento.restaurantId,
                total: resultado.venta.total,
                metodoPago: 'tarjeta'
              }
            },session);
          } else ventasPostCommit.push(resultado.venta);
        }
        if (outboxEnabled) {
            await registrarEventoEnTransaccion({
              eventId: 'PEDIDO_ACTUALIZADO:'+String(pedido._id)+':PAGADO',
              empresaId: restaurante.empresaId,
              sedeId: sedeObjectId,
              eventName: 'PEDIDO_ACTUALIZADO',
              aggregateId: pedido._id,
              payload: {pedidoId:String(pedido._id),restaurantId:lockedIntento.restaurantId,estadoPago:'pagado'}
            },session);
        }
      }

      lockedIntento.estado = "APROBADO";
      lockedIntento.transactionId = String(transaction.id);
      lockedIntento.resueltoAt = new Date();
      await lockedIntento.save({ session });
    });

    for (const venta of ventasPostCommit) emitirVentaCompletada(venta);
    if (!outboxEnabled && io && empresaNotificacionId) for (const pedido of pedidosPostCommit) io.to(`empresa-${empresaNotificacionId}`).emit("pedido:actualizado", pedido);
    return { handled: true, ok: true, estado: "APROBADO" };
  } finally {
    await session.endSession();
  }
}

module.exports = { confirmarPagoPedidoWompi };
