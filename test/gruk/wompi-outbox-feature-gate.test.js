"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { resolverOutboxWompi } = require("../../services/gruk/resolverOutboxWompi");

const writer = async () => {};

test("GRUK: Outbox Wompi no se habilita en producción ni con flag", () => {
  assert.equal(resolverOutboxWompi({
    env: { NODE_ENV: "production", GRUK_WOMPI_DURABLE_OUTBOX_ENABLED: "true" },
    registrarEventoEnTransaccion: writer
  }), null);
});

test("GRUK: Outbox permanece desactivado por defecto", () => {
  assert.equal(resolverOutboxWompi({ env: { NODE_ENV: "staging" }, registrarEventoEnTransaccion: writer }), null);
});

test("GRUK: staging habilitado obtiene el escritor transaccional", () => {
  assert.equal(resolverOutboxWompi({
    env: { NODE_ENV: "staging", GRUK_WOMPI_DURABLE_OUTBOX_ENABLED: "true" },
    registrarEventoEnTransaccion: writer
  }), writer);
});

test("GRUK: no permite activar sin escritor persistente", () => {
  assert.throws(() => resolverOutboxWompi({
    env: { NODE_ENV: "staging", GRUK_WOMPI_DURABLE_OUTBOX_ENABLED: "true" }
  }), /WOMPI_OUTBOX_WRITER_NO_CONFIGURADO/);
});
