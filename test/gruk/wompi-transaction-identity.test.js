"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../../services/pagosPedidos.service.js"), "utf8");

function fixture({ existingId = "", inputId = "tx-001", state = "PENDIENTE" } = {}) {
  let writes = 0;
  let sessions = 0;
  const intento = { estado: state, transactionId: existingId, amountInCents: 10000, currency: "COP" };
  const Model = {
    async findOne() { return intento; },
    async findOneAndUpdate() { writes++; throw Error("UNEXPECTED_WRITE"); }
  };
  const deps = {
    mongoose: { async startSession() { sessions++; throw Error("UNEXPECTED_SESSION"); } },
    "../models/pedido": {},
    "../models/restaurante": {},
    "../models/sede": {},
    "../models/IntentoPagoPedido": Model,
    "./ventas.service": {},
    "./gruk/validarPedidosIntento": require("../../services/gruk/validarPedidosIntento")
  };
  const mod = { exports: {} };
  vm.runInNewContext(source, {
    module: mod, exports: mod.exports,
    require(id) { assert.ok(Object.hasOwn(deps, id)); return deps[id]; },
    Date, String, Number, Error, console
  }, { filename: "pagosPedidos.service.js", timeout: 1000 });
  return {
    call: () => mod.exports.confirmarPagoPedidoWompi({
      transaction: { reference: "GRUK_PEDIDO_TEST", amount_in_cents: 10000,
        currency: "COP", status: "APPROVED", id: inputId }
    }),
    get writes() { return writes; },
    get sessions() { return sessions; }
  };
}

test("Wompi: rechazo de APPROVED sin transactionId", async () => {
  const f = fixture({ inputId: "" });
  const result = await f.call();
  assert.equal(result.reason, "IDENTIDAD_TRANSACCION_INVALIDA");
  assert.equal(f.writes, 0);
  assert.equal(f.sessions, 0);
});

test("Wompi: intento vinculado a una transacción distinta no se confirma", async () => {
  const f = fixture({ existingId: "tx-original", inputId: "tx-otra" });
  const result = await f.call();
  assert.equal(result.reason, "IDENTIDAD_TRANSACCION_INVALIDA");
  assert.equal(f.writes, 0);
  assert.equal(f.sessions, 0);
});

test("Wompi: ni un pago aprobado acepta un identificador contradictorio", async () => {
  const f = fixture({ existingId: "tx-original", inputId: "tx-otra", state: "APROBADO" });
  const result = await f.call();
  assert.equal(result.reason, "IDENTIDAD_TRANSACCION_INVALIDA");
  assert.equal(f.sessions, 0);
});
