"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { habilitado } = require("../../services/p0/outbox.worker");

test("Outbox worker Wompi requiere dos activaciones en staging", () => {
  assert.equal(habilitado({NODE_ENV:"staging",GRUK_WOMPI_DURABLE_OUTBOX_ENABLED:"true",GRUK_P0_OUTBOX_WORKER_ENABLED:"true"}),true);
  assert.equal(habilitado({NODE_ENV:"staging",GRUK_WOMPI_DURABLE_OUTBOX_ENABLED:"true"}),false);
  assert.equal(habilitado({NODE_ENV:"staging",GRUK_P0_OUTBOX_WORKER_ENABLED:"true"}),false);
});

test("Outbox worker Wompi bloquea producción incluso con flags", () => {
  assert.equal(habilitado({NODE_ENV:"production",GRUK_WOMPI_DURABLE_OUTBOX_ENABLED:"true",GRUK_P0_OUTBOX_WORKER_ENABLED:"true",GRUK_P0_PEDIDOS_ENABLED:"true"}),false);
});

test("Outbox worker conserva activación P0 previa para staging", () => {
  assert.equal(habilitado({NODE_ENV:"staging",GRUK_P0_PEDIDOS_ENABLED:"true",GRUK_P0_OUTBOX_WORKER_ENABLED:"true"}),true);
});
