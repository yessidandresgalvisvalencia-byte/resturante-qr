"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { STATES, assertOrderTransition } = require("../../core/pedidos/orderStateTransitions");

test("states match the currently persisted order model", () => {
  assert.deepEqual(STATES, ["pendiente", "preparando", "listo", "entregado"]);
});
test("allows only forward adjacent lifecycle transitions", () => {
  for (const [from, to] of [["pendiente", "preparando"], ["preparando", "listo"], ["listo", "entregado"]]) {
    assert.deepEqual(assertOrderTransition(from, to), { changed: true, state: to });
  }
});
test("idempotent retries do not change state", () => {
  for (const state of STATES) {
    assert.deepEqual(assertOrderTransition(state, state), { changed: false, state });
  }
});
test("rejects backward, skipped and terminal transitions", () => {
  for (const [from, to] of [["pendiente", "listo"], ["pendiente", "entregado"], ["preparando", "pendiente"], ["listo", "preparando"], ["entregado", "pendiente"]]) {
    assert.throws(() => assertOrderTransition(from, to), /GRUK_ORDER_TRANSITION_FORBIDDEN/);
  }
});
test("rejects unknown and prototype-property states", () => {
  for (const state of ["cancelado", "__proto__", "constructor", "", null, 1]) {
    assert.throws(() => assertOrderTransition(state, "pendiente"), /GRUK_ORDER_STATE_INVALID_SOURCE/);
    assert.throws(() => assertOrderTransition("pendiente", state), /GRUK_ORDER_STATE_INVALID_TARGET/);
  }
});
