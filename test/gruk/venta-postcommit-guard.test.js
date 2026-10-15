"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadVentasService() {
  const source = fs.readFileSync(
    path.join(__dirname, "../../services/ventas.service.js"),
    "utf8"
  );
  let reads = 0;
  let emitted = 0;

  const fakeModel = {
    findOne() {
      reads += 1;
      throw new Error("DB_READ_NOT_EXPECTED");
    }
  };
  const dependencies = {
    mongoose: { Types: { ObjectId: { isValid: () => true } } },
    "../models/Venta": fakeModel,
    "../models/ProductoServicio": fakeModel,
    "../models/Cliente": fakeModel,
    "../core/eventos/eventBus": {
      emit() { emitted += 1; }
    }
  };
  const moduleObj = { exports: {} };
  vm.runInNewContext(source, {
    module: moduleObj,
    exports: moduleObj.exports,
    require(id) {
      assert.ok(Object.hasOwn(dependencies, id), `Unexpected import: ${id}`);
      return dependencies[id];
    },
    console,
    Date,
    Number,
    String,
    Error
  }, { filename: "ventas.service.js", timeout: 1000 });

  return {
    service: moduleObj.exports,
    get reads() { return reads; },
    get emitted() { return emitted; }
  };
}

test("GRUK empresarial: una sesión Mongo activa prohíbe publicar VENTA_COMPLETADA antes del commit", async () => {
  const f = loadVentasService();
  await assert.rejects(
    f.service.registrarVentaDesdePedido({
      pedido: { _id: "pedido-1" },
      empresaId: "empresa-1",
      session: { id: "active-mongo-session" }
    }),
    /evento transaccional prohibido antes de commit/
  );
  assert.equal(f.reads, 0);
  assert.equal(f.emitted, 0);
});

test("GRUK empresarial: una sesión con emitirEvento:false pasa el guard, sin emitir eventos", async () => {
  const f = loadVentasService();
  await assert.rejects(
    f.service.registrarVentaDesdePedido({
      pedido: { _id: "pedido-1", productoServicioId: "producto-1" },
      empresaId: "empresa-1",
      session: { id: "active-mongo-session" },
      emitirEvento: false
    }),
    /DB_READ_NOT_EXPECTED/
  );
  assert.equal(f.reads, 1);
  assert.equal(f.emitted, 0);
});

test("GRUK empresarial: rechaza llamada sin empresa antes de DB", async () => {
  const f = loadVentasService();
  await assert.rejects(
    f.service.registrarVentaDesdePedido({
      pedido: { _id: "pedido-1" },
      session: { id: "session" }
    }),
    /empresaId requerido/
  );
  assert.equal(f.reads, 0);
  assert.equal(f.emitted, 0);
});
