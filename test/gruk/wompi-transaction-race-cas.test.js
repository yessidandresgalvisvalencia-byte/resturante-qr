"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../../services/pagosPedidos.service.js"), "utf8");

test("GRUK Wompi: otro webhook no puede reemplazar transactionId en carrera", async () => {
  const attempt = { estado: "PENDIENTE", transactionId: "", amountInCents: 10000, currency: "COP" };
  let writes = 0;
  const Model = {
    async findOne() { return attempt; },
    async findOneAndUpdate(filter, update) {
      writes++;
      assert.equal(filter.reference, "GRUK_PEDIDO_TEST");
      assert.equal(filter.estado.$ne, "APROBADO");
      assert.equal(Array.from(filter.transactionId.$in).join(","), ",tx-nuevo");
      // Another webhook acquired this attempt first, after initial read.
      attempt.transactionId = "tx-existente";
      if (!filter.transactionId.$in.includes(attempt.transactionId)) return null;
      Object.assign(attempt, update.$set);
      return attempt;
    }
  };
  const dependencies = {
    mongoose: { async startSession() { throw Error("UNEXPECTED_SESSION"); } },
    "../models/pedido": {},
    "../models/restaurante": {},
    "../models/sede": {},
    "../models/IntentoPagoPedido": Model,
    "./ventas.service": {},
    "./gruk/validarPedidosIntento": require("../../services/gruk/validarPedidosIntento"),
    "./gruk/registrarVentaEnOutbox": require("../../services/gruk/registrarVentaEnOutbox"),
    "./gruk/resolverOutboxWompi": require("../../services/gruk/resolverOutboxWompi")
  };
  const moduleRef = { exports: {} };
  vm.runInNewContext(source, {
    module: moduleRef, exports: moduleRef.exports,
    require(id) { assert.ok(Object.hasOwn(dependencies, id)); return dependencies[id]; },
    process: { env: { NODE_ENV: "test" } }, Date, Number, String, Error, console
  }, { timeout: 1000, filename: "pagosPedidos.service.js" });
  const result = await moduleRef.exports.confirmarPagoPedidoWompi({
    transaction: { reference: "GRUK_PEDIDO_TEST", id: "tx-nuevo", status: "DECLINED",
      amount_in_cents: 10000, currency: "COP" }
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "IDENTIDAD_TRANSACCION_INVALIDA");
  assert.equal(attempt.transactionId, "tx-existente");
  assert.equal(writes, 1);
});
