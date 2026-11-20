"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { authorizeOrderBranch } = require("../../core/auth/orderBranch.guard");

const empresaId = "aaaaaaaaaaaaaaaaaaaaaaaa";
const sedeUnoId = "111111111111111111111111";
const sedeDosId = "222222222222222222222222";
const restaurantId = "rest-tenant-a";
const restaurante = { empresaId, restaurantId };
const order = { _id: "333333333333333333333333", empresaId, restaurantId, sedeId: "LOCAL-UNO" };
const adminSede = { empresaId, sedeId: sedeUnoId, rol: "ADMIN_SEDE" };
const dueno = { empresaId, sedeId: null, rol: "DUEÑO" };

function modelFor(site, calls) {
  return {
    findOne(filter) {
      calls.push(filter);
      return {
        session() { return this; },
        async lean() {
          return site && String(filter.empresaId) === String(site.empresaId) &&
            filter.restauranteId === site.restauranteId &&
            (filter.$or[0].codigoSede === site.codigoSede ||
             filter.$or[1]._id === site._id) ? site : null;
        }
      };
    }
  };
}
const sedeUno = { _id: sedeUnoId, empresaId, restauranteId: restaurantId, codigoSede: "LOCAL-UNO" };

test("P0-04: authorized branch can mutate own legacy-coded order with canonical ObjectId", async () => {
  const calls = [];
  const result = await authorizeOrderBranch({
    pedido: order, restaurante, auth: adminSede, siteModel: modelFor(sedeUno, calls)
  });
  assert.equal(result.sedeObjectId, sedeUnoId);
  assert.equal(result.pedidoParaVenta.sedeId, sedeUnoId);
  assert.equal(order.sedeId, "LOCAL-UNO", "persisted order is not mutated by resolution");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].empresaId, empresaId);
  assert.equal(calls[0].restauranteId, restaurantId);
});

test("P0-04: sibling branch cannot mutate or pay another branch's order", async () => {
  const calls = [];
  const siteModel = modelFor(sedeUno, calls);
  await assert.rejects(authorizeOrderBranch({
    pedido: order, restaurante,
    auth: { ...adminSede, sedeId: sedeDosId }, siteModel
  }), /SEDE_FUERA_TENANT/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].$or[1]._id, sedeDosId);
});

test("P0-04: foreign tenant and mismatched legacy order tenant fail before any branch DB read", async () => {
  const calls = [];
  const siteModel = modelFor(sedeUno, calls);
  await assert.rejects(authorizeOrderBranch({
    pedido: { ...order, empresaId: "bbbbbbbbbbbbbbbbbbbbbbbb" },
    restaurante, auth: adminSede, siteModel
  }), /PEDIDO_FUERA_TENANT/);
  await assert.rejects(authorizeOrderBranch({
    pedido: { ...order, restaurantId: "rest-foreign" },
    restaurante, auth: adminSede, siteModel
  }), /PEDIDO_FUERA_TENANT/);
  assert.equal(calls.length, 0);
});

test("P0-04: branch staff cannot access site-less legacy orders", async () => {
  const calls = [];
  await assert.rejects(authorizeOrderBranch({
    pedido: { ...order, sedeId: "" },
    restaurante, auth: adminSede, siteModel: modelFor(sedeUno, calls)
  }), /PEDIDO_SIN_SEDE/);
  await assert.rejects(authorizeOrderBranch({
    pedido: order, restaurante, auth: { empresaId, rol: "EMPLEADO", sedeId: null },
    siteModel: modelFor(sedeUno, calls)
  }), /SEDE_AUTORIZADA_REQUERIDA/);
  assert.equal(calls.length, 0);
});

test("P0-04: company owner may resolve a valid site, but not a foreign or missing site", async () => {
  const calls = [];
  const siteModel = modelFor(sedeUno, calls);
  const valid = await authorizeOrderBranch({ pedido: order, restaurante, auth: dueno, siteModel });
  assert.equal(valid.sedeObjectId, sedeUnoId);
  await assert.rejects(authorizeOrderBranch({
    pedido: { ...order, sedeId: sedeDosId }, restaurante, auth: dueno, siteModel
  }), /SEDE_FUERA_TENANT/);
  const legacy = await authorizeOrderBranch({
    pedido: { ...order, sedeId: "" }, restaurante, auth: dueno, siteModel
  });
  assert.equal(legacy.sedeObjectId, null);
  assert.equal(calls.length, 2);
});

test("P0-04: authenticated branch must match the order even if tenant owns both sites", async () => {
  const calls = [];
  await assert.rejects(authorizeOrderBranch({
    pedido: { ...order, sedeId: sedeDosId }, restaurante, auth: adminSede,
    siteModel: modelFor(sedeUno, calls)
  }), /PEDIDO_FUERA_SEDE/);
  assert.equal(calls.length, 1);
});

test("P0-04: payment and status handlers gate their mutations through branch authorization", () => {
  const api = fs.readFileSync(path.join(__dirname, "../../routes/API.js"), "utf8");
  const statusStart = api.indexOf('router.put("/pedido/:id/estado"');
  const paymentStart = api.indexOf('router.put("/pedido/:id/pago"');
  assert.ok(statusStart > 0 && paymentStart > statusStart);
  const statusHandler = api.slice(statusStart, paymentStart);
  const paymentHandler = api.slice(paymentStart, api.indexOf("/* =========================", paymentStart));
  assert.match(statusHandler, /await authorizeOrderBranch\(/);
  assert.match(paymentHandler, /await authorizeOrderBranch\(/);
  assert.ok(statusHandler.indexOf("authorizeOrderBranch") < statusHandler.indexOf("findOneAndUpdate"));
  // Authorization must precede an atomic write that also constrains tenant,
  // restaurant and original site to prevent a concurrent ownership change.
  assert.match(statusHandler, /Pedido\.findOneAndUpdate\(/);
  assert.match(statusHandler, /restaurantId:\s*actual\.restaurantId/);
  assert.match(statusHandler, /empresaId:\s*actual\.empresaId/);
  assert.match(statusHandler, /sedeId:\s*actual\.sedeId/);
  assert.ok(paymentHandler.indexOf("authorizeOrderBranch") < paymentHandler.indexOf("registrarVentaDesdePedido"));
  assert.ok(paymentHandler.indexOf("authorizeOrderBranch") < paymentHandler.indexOf("pedido.estadoPago ="));
});
