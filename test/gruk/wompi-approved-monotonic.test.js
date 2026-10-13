"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../../services/pagosPedidos.service.js"), "utf8");

for (const status of ["PENDING", "DECLINED", "ERROR", "VOIDED", "APPROVED"]) {
  test(`GRUK Wompi: webhook ${status} no revierte intento APROBADO`, async () => {
    let saves = 0;
    let sessions = 0;
    const intento = {
      estado: "APROBADO",
      amountInCents: 10000,
      currency: "COP",
      async save() { saves++; }
    };
    const deps = {
      mongoose: { async startSession() { sessions++; throw new Error("NO_SESSION_EXPECTED"); } },
      "../models/pedido": {},
      "../models/restaurante": {},
      "../models/sede": {},
      "../models/IntentoPagoPedido": { async findOne() { return intento; } },
      "./ventas.service": {},
    "./gruk/validarPedidosIntento": require("../../services/gruk/validarPedidosIntento"),
    "./gruk/registrarVentaEnOutbox": require("../../services/gruk/registrarVentaEnOutbox"),
    "./gruk/resolverOutboxWompi": require("../../services/gruk/resolverOutboxWompi")
    };
    const mod = { exports: {} };
    vm.runInNewContext(source, {
      module: mod,
      exports: mod.exports,
      require(id) {
        assert.ok(Object.hasOwn(deps, id), `Unexpected dependency: ${id}`);
        return deps[id];
      },
      Date, String, Number, Error, console
    }, { timeout: 1000, filename: "pagosPedidos.service.js" });
    const outcome = await mod.exports.confirmarPagoPedidoWompi({
      transaction: {
        reference: "GRUK_PEDIDO_TEST",
        amount_in_cents: 10000,
        currency: "COP",
        status,
        id: "old-transaction"
      }
    });
    assert.equal(outcome.estado, "APROBADO");
    assert.equal(outcome.idempotent, true);
    assert.equal(intento.estado, "APROBADO");
    assert.equal(saves, 0);
    assert.equal(sessions, 0);
  });
}
