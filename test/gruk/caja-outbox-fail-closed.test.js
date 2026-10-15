"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { despacharSiguienteVentaACaja } = require("../../core/eventos/cajaVenta.dispatcher");

test("Caja-only dispatcher fails closed instead of acknowledging shared outbox", async () => {
  await assert.rejects(
    despacharSiguienteVentaACaja(),
    /CAJA_OUTBOX_REQUIERE_ACK_POR_CONSUMIDOR/
  );
});
