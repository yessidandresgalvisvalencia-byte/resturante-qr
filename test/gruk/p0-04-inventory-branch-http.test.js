"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const Inventario = require("../../models/Inventario");
const Restaurante = require("../../models/restaurante");
const inventarioRoutes = require("../../routes/inventario");

const SECRET = "p004-inventory-branch-regression-local-only";
const EMPRESA = "aaaaaaaaaaaaaaaaaaaaaaaa";
const OTRA = "bbbbbbbbbbbbbbbbbbbbbbbb";
const SEDE_UNO = "111111111111111111111111";
const SEDE_DOS = "222222222222222222222222";
const PRODUCTO = "333333333333333333333333";

function fakeRestaurant(found) {
  const item = found ? { empresaId: EMPRESA, restaurantId: "rest-a" } : null;
  return {
    select() { return this; },
    async lean() { return item; },
    then(resolve, reject) { return Promise.resolve(item).then(resolve, reject); }
  };
}
test("P0-04 inventory HTTP: prevent cross-company and cross-site reads, writes and cancellations", async () => {
  const oldSecret = process.env.JWT_SECRET;
  const original = {
    findOne: Restaurante.findOne,
    find: Inventario.find,
    save: Inventario.prototype.save,
    findOneAndUpdate: Inventario.findOneAndUpdate
  };
  const calls = { restaurant: [], reads: [], updates: [] };
  let simulateAlreadyAnnulled = false;
  const createdInventory = [];
  Inventario.prototype.save = async function () {
    createdInventory.push(this.toObject());
    return this;
  };

  Restaurante.findOne = (filter) => {
    calls.restaurant.push(filter);
    return fakeRestaurant(filter.restaurantId === "rest-a" && String(filter.empresaId) === EMPRESA);
  };
  Inventario.find = (filter) => {
    calls.reads.push(filter);
    return { select() { return this; }, async lean() { return []; } };
  };
  Inventario.findOneAndUpdate = async (filter, update) => {
    calls.updates.push({ ...filter, auditActor: update.usuarioAnulacion });
    if (simulateAlreadyAnnulled) return null;
    return { _id: PRODUCTO, empresaId: EMPRESA, sedeId: SEDE_UNO };
  };

  const app = express();
  app.use(express.json());
  app.use("/api/inventario", inventarioRoutes);
  const server = await new Promise(resolve => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });

  function auth(empresaId, sedeId, rol = "ADMIN_SEDE") {
    return jwt.sign({
      sub: "444444444444444444444444",
      empresaId,
      ...(sedeId ? { sedeId } : {}),
      rol,
      tokenVersion: 0
    }, SECRET, { algorithm: "HS256", expiresIn: "5m" });
  }
  async function call(method, route, token, body) {
    const response = await fetch("http://127.0.0.1:" + server.address().port + "/api/inventario" + route, {
      method,
      headers: {
        ...(token ? { authorization: "Bearer " + token } : {}),
        "content-type": "application/json"
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    return { status: response.status, data: await response.json() };
  }

  try {
    process.env.JWT_SECRET = SECRET;
    const admin = auth(EMPRESA, SEDE_UNO);
    const owner = auth(EMPRESA, null, "DUEÑO");
    const crossTenant = auth(OTRA, SEDE_DOS);
    const missingSite = auth(EMPRESA, null);

    let result = await call("GET", "/rest-a", admin);
    assert.equal(result.status, 200, JSON.stringify(result.data));
    assert.equal(calls.reads.length, 1);
    assert.equal(String(calls.reads[0].empresaId), EMPRESA);
    assert.equal(String(calls.reads[0].sedeId), SEDE_UNO);

    result = await call("GET", "/rest-a", owner);
    assert.equal(result.status, 200);
    assert.equal(Object.hasOwn(calls.reads.at(-1), "sedeId"), false, "only owner may view all branches");

    result = await call("GET", "/rest-a", crossTenant);
    assert.equal(result.status, 403);
    result = await call("GET", "/rest-a", missingSite);
    assert.equal(result.status, 403);
    result = await call("GET", "/rest-b", admin);
    assert.equal(result.status, 403);
    assert.equal(calls.reads.length, 2, "denied requests cannot read inventory");

    result = await call("POST", "/", admin, {
      nombre: "Sin restaurante", categoria: "prueba", cantidad: 1
    });
    assert.equal(result.status, 400, "new inventory must have an owned restaurant");
    assert.equal(createdInventory.length, 0);

    for (const protectedField of ["anulado", "motivoAnulacion", "usuarioAnulacion", "fechaAnulacion", "_id"]) {
      result = await call("POST", "/", admin, {
        restaurantId: "rest-a", nombre: "Fraude", categoria: "prueba", cantidad: 1,
        [protectedField]: protectedField === "anulado" ? true : "forged"
      });
      assert.equal(result.status, 400, protectedField + " cannot be forged at creation");
    }
    assert.equal(createdInventory.length, 0);

    result = await call("POST", "/", admin, {
      restaurantId: "rest-a", nombre: "Producto legítimo", categoria: "prueba", cantidad: 2
    });
    assert.equal(result.status, 200, JSON.stringify(result.data));
    assert.equal(createdInventory.length, 1);
    assert.equal(String(createdInventory[0].empresaId), EMPRESA);
    assert.equal(String(createdInventory[0].sedeId), SEDE_UNO);
    assert.equal(createdInventory[0].restaurantId, "rest-a");
    assert.equal(createdInventory[0].anulado, false);

    result = await call("POST", "/", admin, {
      restaurantId: "rest-a", sedeId: SEDE_DOS,
      nombre: "Producto prohibido", categoria: "prueba", cantidad: 10
    });
    assert.equal(result.status, 403, "branch staff cannot create sibling-site inventory");

    result = await call("POST", "/", admin, {
      restaurantId: "rest-b", empresaId: EMPRESA,
      nombre: "Producto ajeno", categoria: "prueba", cantidad: 10
    });
    assert.equal(result.status, 403, "company-owned data cannot be created in foreign restaurant");

    result = await call("PUT", "/anular/" + PRODUCTO, admin, { motivo: "prueba" });
    assert.equal(result.status, 200, JSON.stringify(result.data));
    assert.equal(calls.updates.length, 1);
    assert.equal(calls.updates[0].sedeId, SEDE_UNO);
    assert.equal(calls.updates[0].empresaId, EMPRESA);
    assert.equal(calls.updates[0].anulado, false, "cancellation must be atomic and single-use");
    assert.equal(calls.updates[0].auditActor, "444444444444444444444444", "caller may not spoof audit actor");

    result = await call("PUT", "/anular/" + PRODUCTO, admin, { motivo: "prueba", usuario: "admin-falsificado" });
    assert.equal(result.status, 200);
    assert.equal(calls.updates.at(-1).auditActor, "444444444444444444444444");

    result = await call("PUT", "/anular/" + PRODUCTO, owner, { motivo: "prueba" });
    assert.equal(result.status, 200);
    assert.equal(Object.hasOwn(calls.updates[2], "sedeId"), false);
    assert.equal(calls.updates[2].anulado, false);

    simulateAlreadyAnnulled = true;
    result = await call("PUT", "/anular/" + PRODUCTO, admin, { motivo: "segundo intento" });
    assert.equal(result.status, 404, "an already cancelled record cannot be cancelled again");
    assert.equal(calls.updates.at(-1).anulado, false);
    simulateAlreadyAnnulled = false;

    result = await call("PUT", "/anular/" + PRODUCTO, missingSite, { motivo: "prueba" });
    assert.equal(result.status, 403);
    assert.equal(calls.updates.length, 4);

    result = await call("GET", "/rest-a", null);
    assert.equal(result.status, 401);
    assert.equal(calls.reads.length, 2);
    assert.ok(mongoose.Types.ObjectId.isValid(SEDE_UNO));
  } finally {
    await new Promise(resolve => server.close(resolve));
    Restaurante.findOne = original.findOne;
    Inventario.find = original.find;
    Inventario.prototype.save = original.save;
    Inventario.findOneAndUpdate = original.findOneAndUpdate;
    if (oldSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = oldSecret;
  }
});
