"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

test("Caja durable adapter exports a callable consumer without starting a worker", () => {
  const { consumirVentaEnCaja } = require("../../core/eventos/cajaVenta.consumer");
  assert.equal(typeof consumirVentaEnCaja, "function");
});

test("Caja durable adapter rejects malformed outbox identities before writing", async () => {
  const { consumirVentaEnCaja } = require("../../core/eventos/cajaVenta.consumer");
  await assert.rejects(
    consumirVentaEnCaja({ eventId: "invalid", empresaId: "invalid" }),
    /CONSUMIDOR_IDENTIDAD_INVALIDA/
  );
});
