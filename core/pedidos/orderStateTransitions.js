"use strict";

// The states match models/pedido.js. This pure guard does not mutate orders.
const TRANSITIONS = Object.freeze({
  pendiente: Object.freeze(["preparando"]),
  preparando: Object.freeze(["listo"]),
  listo: Object.freeze(["entregado"]),
  entregado: Object.freeze([])
});
const STATES = Object.freeze(Object.keys(TRANSITIONS));

function assertOrderTransition(from, to) {
  if (typeof from !== "string" || !Object.hasOwn(TRANSITIONS, from)) {
    throw new TypeError("GRUK_ORDER_STATE_INVALID_SOURCE");
  }
  if (typeof to !== "string" || !Object.hasOwn(TRANSITIONS, to)) {
    throw new TypeError("GRUK_ORDER_STATE_INVALID_TARGET");
  }
  if (from === to) return { changed: false, state: from };
  if (!TRANSITIONS[from].includes(to)) {
    throw new Error("GRUK_ORDER_TRANSITION_FORBIDDEN");
  }
  return { changed: true, state: to };
}

module.exports = { STATES, TRANSITIONS, assertOrderTransition };
