"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "../../services/pagosPedidos.service.js"), "utf8");

test("Wompi: la escritura Outbox se espera dentro de withTransaction", () => {
  const txStart = source.indexOf("await session.withTransaction(async () => {");
  const txEnd = source.indexOf("\n    });", txStart);
  const outbox = source.indexOf("await registrarVentaEnOutbox(", txStart);
  assert.ok(txStart >= 0 && outbox > txStart && outbox < txEnd);
});

test("Wompi: modo Outbox no publica en paralelo el evento legacy", () => {
  assert.match(source, /if \(writer\) \{[\s\S]*?await registrarVentaEnOutbox\([\s\S]*?\} else \{\s*ventasPostCommit\.push/);
});

test("Wompi: la integración es opcional y no enciende el worker experimental", () => {
  assert.match(source, /outboxWriter = null/);
  assert.match(source, /resolverOutboxWompi\(\{ env, registrarEventoEnTransaccion: outboxWriter \}\)/);
  assert.doesNotMatch(source, /require\(["']\.\/p0\/outbox\.service/);
});
