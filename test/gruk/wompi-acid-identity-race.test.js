"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const code = fs.readFileSync(path.join(__dirname, "../../services/pagosPedidos.service.js"), "utf8");

function makeFixture(patch = {}) {
  const persisted = {
    reference: "GRUK_PEDIDO_TEST", estado: "PENDIENTE",
    amountInCents: 10000, currency: "COP", transactionId: "", ...patch
  };
  let sessionStarted = 0;
  let updatedOrders = 0;
  const deps = {
    mongoose: {
      async startSession() {
        sessionStarted++;
        return {
          async withTransaction(callback) { await callback(); },
          async endSession() {}
        };
      }
    },
    "../models/pedido": {
      find() { updatedOrders++; throw Error("UNEXPECTED_PEDIDO_QUERY"); }
    },
    "../models/restaurante": {},
    "../models/sede": {},
    "../models/IntentoPagoPedido": {
      async findOne() { return this._read(); },
      _readCount: 0,
      _read() {
        this._readCount++;
        if (this._readCount === 1) return { ...persisted, transactionId: "", amountInCents: 10000, currency: "COP" };
        return persisted;
      }
    },
    "./ventas.service": {}
  };
  deps["../models/IntentoPagoPedido"].findOne = function () {
    const v = this._read();
    if (this._readCount === 1) return Promise.resolve(v);
    return { async session() { return v; } };
  };
  const moduleObj = { exports: {} };
  vm.runInNewContext(code, {
    module: moduleObj, exports: moduleObj.exports,
    require(id) { assert.ok(Object.hasOwn(deps, id)); return deps[id]; },
    Date, Number, String, Error, console
  }, { filename: "pagosPedidos.service.js", timeout: 1000 });
  return {
    call: () => moduleObj.exports.confirmarPagoPedidoWompi({
      transaction: { reference: "GRUK_PEDIDO_TEST", status: "APPROVED",
        id: "tx-001", amount_in_cents: 10000, currency: "COP" }
    }),
    get sessionStarted() { return sessionStarted; },
    get updatedOrders() { return updatedOrders; }
  };
}

test("Wompi ACID: no procesa venta si el ID persistido cambia tras lectura inicial", async () => {
  const f = makeFixture({ transactionId: "tx-diferente" });
  await assert.rejects(f.call(), /IDENTIDAD_TRANSACCION_INVALIDA/);
  assert.equal(f.sessionStarted, 1);
  assert.equal(f.updatedOrders, 0);
});

test("Wompi ACID: no procesa venta si importe persistido es inconsistente en snapshot", async () => {
  const f = makeFixture({ amountInCents: 20000 });
  await assert.rejects(f.call(), /INTEGRIDAD_ECONOMICA_INVALIDA/);
  assert.equal(f.sessionStarted, 1);
  assert.equal(f.updatedOrders, 0);
});
