"use strict";
// P0-70: payment authorization must bind both the tenant and site to the
// MongoDB read inside the financial transaction. The locator grants no access.
const Pedido = require("../../models/pedido");
const { resolveLlamadosScope } = require("../realtime/llamadosTenant.service");

const OBJECT_ID = /^[a-f0-9]{24}$/i;

async function resolvePedidoPagoScope({ pedidoId, auth }, {
  PedidoModel = Pedido, resolveScope = resolveLlamadosScope
} = {}) {
  if (typeof pedidoId !== "string" || !OBJECT_ID.test(pedidoId))
    return { status: 400, error: "Identificador de pedido inválido" };

  // Read only a restaurant locator; never return this document to the caller.
  const locator = await PedidoModel.findById(pedidoId).select("restaurantId").lean();
  if (!locator || typeof locator.restaurantId !== "string")
    return { status: 404, error: "Pedido no encontrado" };

  // Resolve JWT company/restaurant/site against persisted MongoDB ownership.
  const scope = await resolveScope(auth, locator.restaurantId);
  if (!scope || scope.restaurantId !== locator.restaurantId)
    return { status: 403, error: "Pedido fuera del ámbito autorizado" };

  // The route MUST use this exact predicate in its transaction-scoped findOne.
  // A post-hoc site check after findById is not sufficient for financial writes.
  return { status: 200, filter: { _id: pedidoId, ...scope } };
}

module.exports = { resolvePedidoPagoScope };
