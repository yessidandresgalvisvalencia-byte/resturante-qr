"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(
  path.join(__dirname, "../../services/pagosPedidos.service.js"), "utf8"
);

test("Wompi: each withTransaction retry resets pending events before writes", () => {
  const callback = source.indexOf("await session.withTransaction(async () => {");
  const resetVentas = source.indexOf("ventasPostCommit.length = 0;", callback);
  const resetPedidos = source.indexOf("pedidosPostCommit.length = 0;", callback);
  const createVenta = source.indexOf("await registrarVentaDesdePedido({", callback);
  assert.ok(callback >= 0 && resetVentas > callback && resetPedidos > callback);
  assert.ok(resetVentas < createVenta && resetPedidos < createVenta);
});

test("Wompi: does not emit sales events before the transaction resolves", () => {
  const tx = source.indexOf("await session.withTransaction(async () => {");
  const end = source.indexOf("\n    });", tx);
  const emit = source.indexOf("for (const venta of ventasPostCommit) emitirVentaCompletada(venta)");
  assert.ok(tx >= 0 && end > tx && emit > end);
  assert.match(source.slice(tx, end), /session,\s*emitirEvento:\s*false/);
});
