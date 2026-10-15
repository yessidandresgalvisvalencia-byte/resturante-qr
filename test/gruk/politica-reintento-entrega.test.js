"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { evaluarReintentoEntrega, MAX_ATTEMPTS } =
  require("../../core/eventos/politicaReintentoEntrega");

test("retry policy is bounded and does not retry delivered or active leases", () => {
  const now = new Date("2026-10-15T12:00:00Z");
  assert.deepEqual(evaluarReintentoEntrega({
    intentos: 0, estado: "PENDIENTE", now
  }), { accion: "REINTENTAR", delayMs: 0, intentos: 0 });
  assert.equal(evaluarReintentoEntrega({
    intentos: 1, estado: "PENDIENTE", now
  }).delayMs, 30000);
  assert.equal(evaluarReintentoEntrega({
    intentos: 3, estado: "PENDIENTE", now
  }).delayMs, 120000);
  assert.equal(evaluarReintentoEntrega({
    intentos: 7, estado: "PENDIENTE", now
  }).delayMs, 1920000);
  assert.equal(evaluarReintentoEntrega({
    intentos: MAX_ATTEMPTS, estado: "PENDIENTE", now
  }).accion, "CUARENTENA_RECOMENDADA");
  assert.equal(evaluarReintentoEntrega({
    intentos: 0, estado: "ENTREGADO", now
  }).accion, "NINGUNA");
  assert.equal(evaluarReintentoEntrega({
    intentos: 1, estado: "PROCESANDO",
    leaseHasta: new Date(now.getTime() + 1000), now
  }).accion, "ESPERAR");
  assert.equal(evaluarReintentoEntrega({
    intentos: 1, estado: "PROCESANDO",
    leaseHasta: new Date(now.getTime() - 1000), now
  }).accion, "REINTENTAR");
  assert.throws(() => evaluarReintentoEntrega({
    intentos: -1, estado: "PENDIENTE", now
  }), /ENTREGA_REINTENTO_PARAMETROS_INVALIDOS/);
});
