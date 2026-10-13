"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "../../services/pagosPedidos.service.js"), "utf8");

function loadService({ initialState = "PENDIENTE", race = false } = {}) {
  const attempt = { estado: initialState, amountInCents: 10000, currency: "COP" };
  let updateCalls = 0, sessionCalls = 0;
  const Model = {
    async findOne() { return attempt; },
    async findOneAndUpdate(filter, update) {
      updateCalls++;
      assert.equal(filter.reference, "GRUK_PEDIDO_TEST");
      if (update.$set.estado === "PENDIENTE") {
        assert.equal(Array.from(filter.estado.$in).join(","), "CREADO,PENDIENTE");
      } else {
        assert.equal(filter.estado.$ne, "APROBADO");
      }
      if (race) attempt.estado = "APROBADO";
      if (attempt.estado === "APROBADO") return null;
      Object.assign(attempt, update.$set);
      return attempt;
    }
  };
  const deps = {
    mongoose: { async startSession() { sessionCalls++; throw Error("unexpected session"); } },
    "../models/pedido": {},
    "../models/restaurante": {},
    "../models/sede": {},
    "../models/IntentoPagoPedido": Model,
    "./ventas.service": {},
    "./gruk/validarPedidosIntento": require("../../services/gruk/validarPedidosIntento"),
    "./gruk/registrarVentaEnOutbox": require("../../services/gruk/registrarVentaEnOutbox"),
    "./gruk/resolverOutboxWompi": require("../../services/gruk/resolverOutboxWompi")
  };
  const moduleObj = { exports: {} };
  vm.runInNewContext(source, {
    module: moduleObj, exports: moduleObj.exports,
    require(id) { assert.ok(Object.hasOwn(deps, id)); return deps[id]; },
    Date, String, Number, Error, console
  }, { filename: "pagosPedidos.service.js", timeout: 1000 });
  return {
    call: status => moduleObj.exports.confirmarPagoPedidoWompi({
      transaction: { reference: "GRUK_PEDIDO_TEST", amount_in_cents: 10000,
        currency: "COP", status, id: "tx-001" }
    }),
    attempt,
    get updateCalls() { return updateCalls; },
    get sessionCalls() { return sessionCalls; }
  };
}

test("Wompi: estado PENDING se aplica con filtro que excluye pagos aprobados", async () => {
  const f = loadService();
  const result = await f.call("PENDING");
  assert.equal(result.estado, "PENDIENTE");
  assert.equal(f.updateCalls, 1);
  assert.equal(f.sessionCalls, 0);
});

test("Wompi: si APPROVED gana carrera, notificación DECLINED no revierte", async () => {
  const f = loadService({ race: true });
  const result = await f.call("DECLINED");
  assert.equal(result.estado, "APROBADO");
  assert.equal(result.idempotent, true);
  assert.equal(f.attempt.estado, "APROBADO");
  assert.equal(f.updateCalls, 1);
});

test("Wompi: estado inesperado no modifica intento", async () => {
  const f = loadService();
  const result = await f.call("UNKNOWN");
  assert.equal(result.ok, false);
  assert.equal(result.reason, "ESTADO_PROVEEDOR_INVALIDO");
  assert.equal(f.updateCalls, 0);
});

test("Wompi: un PENDING atrasado no reabre un RECHAZADO", async () => {
  const f = loadService({ initialState: "RECHAZADO" });
  const result = await f.call("PENDING");
  assert.equal(result.estado, "RECHAZADO");
  assert.equal(result.idempotent, true);
  assert.equal(f.updateCalls, 0);
});
