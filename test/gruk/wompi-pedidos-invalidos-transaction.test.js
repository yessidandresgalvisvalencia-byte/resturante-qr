"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const code = fs.readFileSync(path.join(__dirname, "../../services/pagosPedidos.service.js"), "utf8");
const oid = "507f1f77bcf86cd799439011";

for (const ids of [[], [oid, oid], ["invalid"]]) {
  test("Wompi ACID rechaza pedidos inválidos antes de cargar pedido o registrar venta: " + JSON.stringify(ids), async () => {
    let ordersRead = 0;
    let salesWritten = 0;
    const receipt = {
      reference: "GRUK_PEDIDO_CHECK", amountInCents: 10000, currency: "COP",
      transactionId: "", estado: "PENDIENTE", restaurantId: "test", pedidoIds: ids
    };
    const payment = { reference: receipt.reference, amount_in_cents: 10000,
      currency: "COP", id: "tx-check", status: "APPROVED" };
    let reads = 0;
    const deps = {
      mongoose: {
        async startSession() {
          return { async withTransaction(cb) { await cb(); }, async endSession() {} };
        }
      },
      "../models/pedido": {
        find() { ordersRead++; throw Error("UNEXPECTED_ORDER_READ"); }
      },
      "../models/restaurante": {
        findOne() {
          return { select() { return { session() { return { lean: async () => ({ empresaId: oid }) }; } }; } };
        }
      },
      "../models/sede": {},
      "../models/IntentoPagoPedido": {
        findOne() {
          reads++;
          if (reads === 1) return Promise.resolve(receipt);
          return { async session() { return receipt; } };
        }
      },
      "./ventas.service": { async registrarVentaDesdePedido() { salesWritten++; } },
      "./gruk/validarPedidosIntento": require("../../services/gruk/validarPedidosIntento"),
    "./gruk/registrarVentaEnOutbox": require("../../services/gruk/registrarVentaEnOutbox"),
    "./gruk/resolverOutboxWompi": require("../../services/gruk/resolverOutboxWompi"),
    "./gruk/totalPedidoCopEnCentavos": require("../../services/gruk/totalPedidoCopEnCentavos")
    };
    const mod = { exports: {} };
    vm.runInNewContext(code, {
      module: mod, exports: mod.exports,
      require(id) { assert.ok(Object.hasOwn(deps, id), id); return deps[id]; },
      process: { env: { NODE_ENV: "test" } }, Date, String, Number, Error, Set, console
    }, { filename: "pagosPedidos.service.js", timeout: 1000 });
    await assert.rejects(
      mod.exports.confirmarPagoPedidoWompi({ transaction: payment }),
      /PEDIDOS_DEL_INTENTO_INVALIDOS/
    );
    assert.equal(ordersRead, 0);
    assert.equal(salesWritten, 0);
  });
}
