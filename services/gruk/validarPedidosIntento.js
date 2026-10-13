"use strict";

// Pure guard: call this before loading or charging orders from a payment intent.
// Does not mutate the intent or cause any payment-provider side effects.
function validarPedidosIntento(pedidoIds) {
  if (!Array.isArray(pedidoIds) || pedidoIds.length === 0) {
    throw new Error("PEDIDOS_DEL_INTENTO_INVALIDOS");
  }
  const ids = pedidoIds.map(id => {
    if (id === null || id === undefined) throw new Error("PEDIDOS_DEL_INTENTO_INVALIDOS");
    const value = String(id);
    if (!/^[0-9a-f]{24}$/i.test(value)) throw new Error("PEDIDOS_DEL_INTENTO_INVALIDOS");
    return value.toLowerCase();
  });
  if (new Set(ids).size !== ids.length) {
    throw new Error("PEDIDOS_DEL_INTENTO_INVALIDOS");
  }
  return ids;
}

module.exports = { validarPedidosIntento };
