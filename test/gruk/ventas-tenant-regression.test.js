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

test("Wompi order payment persists outbox without direct post-commit emission", () => {
 const payment = fs.readFileSync(path.join(__dirname, "../../services/pagosPedidos.service.js"), "utf8");
 const transactionStart = payment.indexOf("await session.withTransaction(");
 assert.ok(transactionStart >= 0);
 assert.doesNotMatch(payment, /emitirVentaCompletada\(/);
 assert.match(payment, /await registrarVentaDesdePedido\(/);
 assert.match(payment, /emitirEvento:\s*false/);
});

test("manual order payment persists transactional outbox without direct emission", () => {
 const api = fs.readFileSync(path.join(__dirname, "../../routes/API.js"), "utf8");
 const registration = api.indexOf("await registrarVentaDesdePedido({");
 assert.ok(registration >= 0);
 const tail = api.slice(registration, registration + 1100);
 assert.match(tail, /emitirEvento:\s*false/);
 assert.doesNotMatch(api, /emitirVentaCompletada\(/);
 assert.doesNotMatch(tail, /ventaPostCommit/);
});

test("index preflight is read-only and tenant-scoped", () => {
 const audit = fs.readFileSync(path.join(__dirname, "../../scripts/audit-venta-idempotency.js"), "utf8");
 assert.match(audit, /empresaId: "\$empresaId"/);
 assert.match(audit, /duplicateCandidateKeyGroups/);
 assert.doesNotMatch(audit, /\.dropIndex\s*\(|\.createIndex\s*\(|\.deleteMany\s*\(|\.updateMany\s*\(/);
});

test("MongoDB transaction callback retries clear deferred effects", () => {
 const payment = fs.readFileSync(path.join(__dirname, "../../services/pagosPedidos.service.js"), "utf8");
 const api = fs.readFileSync(path.join(__dirname, "../../routes/API.js"), "utf8");
 assert.match(payment, /withTransaction\(async \(\) => \{\s*\/\/[^\n]*\n\s*pedidosPostCommit\.length = 0;/);
 assert.match(api, /withTransaction\(async \(\) => \{\s*\/\/[^\n]*\n\s*pedidoFinal = null;/);
});

test("Wompi late declined webhook cannot overwrite approved payment", () => {
 const payment = fs.readFileSync(path.join(__dirname, "../../services/pagosPedidos.service.js"), "utf8");
 assert.match(payment, /estado: \{ \$in: estadosPermitidos \}/);
 assert.match(payment, /ESTADO_PASARELA_DESCONOCIDO/);
 assert.match(payment, /TRANSACCION_DIFERENTE_PARA_REFERENCIA/);
 assert.doesNotMatch(payment, /if \(status !== "APPROVED"\) \{\s*await intento\.save\(\)/);
});

test("Wompi amount must be an exact safe integer in cents", () => {
 const payment = fs.readFileSync(path.join(__dirname, "../../services/pagosPedidos.service.js"), "utf8");
 assert.match(payment, /Number\.isSafeInteger\(amountCents\)/);
 assert.match(payment, /Number\.isSafeInteger\(expectedCents\)/);
 assert.match(payment, /amountCents === expectedCents/);
 assert.match(payment, /TRANSACCION_SIN_IDENTIFICADOR/);
});

test("pending Wompi updates cannot revert rejected payments", () => {
 const payment = fs.readFileSync(path.join(__dirname, "../../services/pagosPedidos.service.js"), "utf8");
 assert.match(payment, /siguienteEstado === "PENDIENTE"\s*\? \["CREADO", "PENDIENTE"\]/);
 assert.match(payment, /estado: actual\?\.estado \|\| "DESCONOCIDO"/);
});
