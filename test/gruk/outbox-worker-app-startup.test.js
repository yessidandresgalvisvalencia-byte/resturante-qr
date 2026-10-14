"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "../../app.js"), "utf8");
const worker = require("../../services/p0/outbox.worker");

test("El arranque espera conexión MongoDB antes de iniciar Outbox", () => {
  const mongo = app.indexOf("await mongoose.connect(");
  const run = app.indexOf("iniciarOutboxWorker({ io });");
  assert.ok(mongo > 0 && run > mongo);
});
test("No se habilita Outbox en producción ni con ambos flags", () => {
  assert.equal(worker.habilitado({NODE_ENV:"production",GRUK_P0_OUTBOX_WORKER_ENABLED:"true",GRUK_WOMPI_DURABLE_OUTBOX_ENABLED:"true"}), false);
});
test("El worker no se inicia por defecto", () => {
  assert.equal(worker.habilitado({NODE_ENV:"staging"}), false);
});
