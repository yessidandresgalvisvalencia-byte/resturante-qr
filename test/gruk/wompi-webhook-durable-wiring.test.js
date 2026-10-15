"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const route = fs.readFileSync(path.join(__dirname, "../../routes/API.js"), "utf8");
const service = fs.readFileSync(path.join(__dirname, "../../services/pagosPedidos.service.js"), "utf8");
const writer = fs.readFileSync(path.join(__dirname, "../../services/p0/outbox.service.js"), "utf8");

test("webhook Wompi suministra writer persistente de Outbox", () => {
  assert.match(route, /registrarEventoEnTransaccion.*require\("\.\.\/services\/p0\/outbox\.service"\)/);
  assert.match(route, /confirmarPagoPedidoWompi\(\{[\s\S]*?outboxWriter: registrarEventoEnTransaccion/);
});

test("writer Outbox rechaza escrituras fuera de transacción", () => {
  assert.match(writer, /session\.inTransaction\(\)/);
  assert.match(writer, /Outbox\.create\(\[/);
  assert.match(writer, /\],\{session\}\)/);
});

test("servicio Wompi aplica flag staging antes de llamar al writer", () => {
  assert.match(service, /resolverOutboxWompi\(\{ env, registrarEventoEnTransaccion: outboxWriter \}\)/);
});
