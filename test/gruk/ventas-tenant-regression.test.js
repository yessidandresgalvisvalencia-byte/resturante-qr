"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "../../services/ventas.service.js"), "utf8");

test("idempotency recovery requires empresa and sede", () => {
 const section = source.slice(source.indexOf("if (error && error.code === 11000)"));
 assert.match(section, /empresaId,/);
 assert.match(section, /sedeId,/);
 assert.match(section, /origenId: pedido\._id/);
 assert.match(section, /if \(!ventaExistente\) throw error/);
});
test("transactional event emission is deferred", () => {
 assert.match(source, /if \(emitirEvento && !session\)/);
});

test("Wompi order payment emits sales after successful transaction", () => {
 const payment = fs.readFileSync(path.join(__dirname, "../../services/pagosPedidos.service.js"), "utf8");
 const transactionStart = payment.indexOf("await session.withTransaction(");
 const emitAfter = payment.indexOf("for (const venta of ventasPostCommit) emitirVentaCompletada(venta)");
 assert.ok(transactionStart >= 0 && emitAfter > transactionStart);
 assert.match(payment, /emitirEvento:\s*false/);
});
