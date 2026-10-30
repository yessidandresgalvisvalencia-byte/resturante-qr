"use strict";
// P0-70: a staff JWT may only mutate orders within its persisted restaurant/site.
// Reuse the verified tenant/site scope of the operational calls, and enforce
// it in the same MongoDB write predicate (never check site only in JavaScript).
const Pedido = require("../../models/pedido");
const { resolveLlamadosScope } = require("../realtime/llamadosTenant.service");

const OBJECT_ID = /^[a-f0-9]{24}$/i;
const STATES = new Set(["pendiente", "preparando", "listo", "entregado"]);
function validEstimatedMinutes(value) {
  return (typeof value === "number" && Number.isSafeInteger(value) ||
    typeof value === "string" && /^[1-9][0-9]*$/.test(value) &&
      Number.isSafeInteger(Number(value))) &&
    Number(value) >= 1 && Number(value) <= 1440;
}

async function updatePedidoEstado({ pedidoId, auth, estado, tiempoEstimado }, {
  PedidoModel = Pedido, resolveScope = resolveLlamadosScope
} = {}) {
  if (typeof pedidoId !== "string" || !OBJECT_ID.test(pedidoId))
    return { status: 400, error: "Identificador de pedido inválido" };
  if (typeof estado !== "string" || !STATES.has(estado))
    return { status: 400, error: "Estado de pedido inválido" };
  if (tiempoEstimado !== undefined && !validEstimatedMinutes(tiempoEstimado))
    return { status: 400, error: "Tiempo estimado inválido" };

  // This read is only a locator. It grants no authorization or write access.
  const actual = await PedidoModel.findById(pedidoId).select("restaurantId").lean();
  if (!actual || typeof actual.restaurantId !== "string")
    return { status: 404, error: "Pedido no encontrado" };
  const scope = await resolveScope(auth, actual.restaurantId);
  if (!scope || scope.restaurantId !== actual.restaurantId)
    return { status: 403, error: "Pedido fuera del ámbito autorizado" };

  const changes = { estado };
  if (tiempoEstimado !== undefined) changes.tiempoEstimado = Number(tiempoEstimado);
  const pedido = await PedidoModel.findOneAndUpdate(
    { _id: pedidoId, ...scope },
    { $set: changes },
    { new: true, runValidators: true }
  );
  if (!pedido) return { status: 404, error: "Pedido no encontrado en la sede autorizada" };
  return { status: 200, pedido };
}
module.exports = { updatePedidoEstado, validEstimatedMinutes };
