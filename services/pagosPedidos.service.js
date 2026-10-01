"use strict";
const mongoose = require("mongoose");
const Pedido = require("../models/pedido");
const Restaurante = require("../models/restaurante");
const Sede = require("../models/sede");
const IntentoPagoPedido = require("../models/IntentoPagoPedido");
const { registrarVentaDesdePedido, emitirVentaCompletada } = require("./ventas.service");

async function confirmarPagoPedidoWompi({ transaction, io = null }) {
  const reference = String(transaction?.reference || "");
  if (!reference.startsWith("GRUK_PEDIDO_")) return { handled: false };

  const intento = await IntentoPagoPedido.findOne({ reference });
  if (!intento) return { handled: true, ok: false, reason: "INTENTO_NO_ENCONTRADO" };

  const amountOk = Number(transaction.amount_in_cents) === Number(intento.amountInCents);
  const currencyOk = String(transaction.currency || "").toUpperCase() === intento.currency;
  if (!amountOk || !currencyOk) {
    console.error("[SEGURIDAD] Pago de pedido con monto/moneda inconsistente", { reference, transactionId: transaction.id });
    return { handled: true, ok: false, reason: "INTEGRIDAD_ECONOMICA_INVALIDA" };
  }

  const status = String(transaction.status || "").toUpperCase();
  intento.transactionId = String(transaction.id || "");
  if (status === "PENDING") intento.estado = "PENDIENTE";
  if (["DECLINED","ERROR","VOIDED"].includes(status)) {
    intento.estado = "RECHAZADO";
    intento.resueltoAt = new Date();
  }
  if (status !== "APPROVED") {
    await intento.save();
    return { handled: true, ok: true, estado: intento.estado };
  }

  if (intento.estado === "APROBADO") {
    return { handled: true, ok: true, estado: "APROBADO", idempotent: true };
  }

  const session = await mongoose.startSession();
  const ventasPostCommit = [];
  const pedidosPostCommit = [];
  try {
    await session.withTransaction(async () => {
      const lockedIntento = await IntentoPagoPedido.findOne({ reference }).session(session);
      if (!lockedIntento) throw new Error("INTENTO_NO_ENCONTRADO");
      if (lockedIntento.estado === "APROBADO") return;

      const restaurante = await Restaurante.findOne({ restaurantId: lockedIntento.restaurantId })
        .select("_id empresaId").session(session).lean();
      if (!restaurante?.empresaId) throw new Error("RESTAURANTE_SIN_EMPRESA");

      const pedidos = await Pedido.find({
        _id: { $in: lockedIntento.pedidoIds },
        restaurantId: lockedIntento.restaurantId
      }).session(session);

      if (pedidos.length !== lockedIntento.pedidoIds.length) throw new Error("PEDIDOS_INCOMPLETOS");

      const totalActual = pedidos.reduce((sum, p) => sum + Math.round(Number(p.precio) * 100), 0);
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
          emitirEvento: false
        });
        pedido.estadoPago = "pagado";
        pedido.metodoPago = "tarjeta";
        await pedido.save({ session });
        pedidosPostCommit.push(pedido);
        if (resultado.creada) ventasPostCommit.push(resultado.venta);
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
