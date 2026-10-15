"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function buildService({ duplicateError, existingVenta }) {
  const source = fs.readFileSync(path.join(__dirname, "../../services/ventas.service.js"), "utf8");
  const queries = [];
  let emissions = 0;
  const Venta = {
    async create() { throw duplicateError; },
    findOne(query) {
      queries.push(query);
      return { async session() { return existingVenta; } };
    }
  };
  const ProductoServicio = {
    findOne() {
      return {
        select() { return this; },
        session() { return this; },
        async lean() { return { _id: "producto-1", costoUnitario: 300 }; }
      };
    }
  };
  const Cliente = { findOne() { throw new Error("No customer expected"); } };
  const deps = {
    mongoose: { Types: { ObjectId: { isValid: () => true } } },
    "../models/Venta": Venta,
    "../models/ProductoServicio": ProductoServicio,
    "../models/Cliente": Cliente,
    "../core/eventos/eventBus": { emit() { emissions += 1; } }
  };
  const moduleObject = { exports: {} };
  vm.runInNewContext(source, {
    module: moduleObject,
    exports: moduleObject.exports,
    require(id) {
      assert.ok(Object.hasOwn(deps, id));
      return deps[id];
    },
    Date, String, Number, Error, console
  }, { filename: "ventas.service.js", timeout: 1000 });
  const pedido = {
    _id: "pedido-1",
    productoServicioId: "producto-1",
    cantidad: 1,
    precioUnitario: 1500,
    precio: 1500,
    producto: "Producto",
    restaurantId: "rest-1"
  };
  return {
    call: () => moduleObject.exports.registrarVentaDesdePedido({
      pedido, empresaId: "empresa-1", emitirEvento: false
    }),
    queries,
    get emissions() { return emissions; }
  };
}

test("duplicado de pedido: recupera únicamente la venta del tenant", async () => {
  const original = new Error("duplicate");
  original.code = 11000;
  original.keyPattern = { origen: 1, origenId: 1 };
  const expected = { _id: "venta-1", empresaId: "empresa-1" };
  const f = buildService({ duplicateError: original, existingVenta: expected });
  const result = await f.call();
  assert.equal(result.creada, false);
  assert.equal(result.venta, expected);
  assert.equal(f.queries.length, 1);
  assert.equal(f.queries[0].empresaId, "empresa-1");
  assert.equal(f.queries[0].origen, "restaurante");
  assert.equal(f.queries[0].origenId, "pedido-1");
  assert.equal(f.emissions, 0);
});

test("duplicado global cuyo registro no pertenece al tenant: error, no falso éxito", async () => {
  const original = new Error("duplicate");
  original.code = 11000;
  original.keyPattern = { origen: 1, origenId: 1 };
  const f = buildService({ duplicateError: original, existingVenta: null });
  await assert.rejects(f.call(), error => error === original);
  assert.equal(f.queries.length, 1);
  assert.equal(f.emissions, 0);
});

test("un índice único no relacionado no se disfraza de venta existente", async () => {
  const original = new Error("duplicate");
  original.code = 11000;
  original.keyPattern = { transactionId: 1 };
  const f = buildService({ duplicateError: original, existingVenta: null });
  await assert.rejects(f.call(), error => error === original);
  assert.equal(f.queries.length, 0);
  assert.equal(f.emissions, 0);
});
