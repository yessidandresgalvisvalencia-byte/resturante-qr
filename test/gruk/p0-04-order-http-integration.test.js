"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const Pedido = require("../../models/pedido");
const Restaurante = require("../../models/restaurante");
const Sede = require("../../models/sede");
const apiRouter = require("../../routes/API");

const SECRET = "gruk-p004-http-branch-isolation-ci-only-secret";
const COMPANY_A = "aaaaaaaaaaaaaaaaaaaaaaaa";
const COMPANY_B = "bbbbbbbbbbbbbbbbbbbbbbbb";
const SITE_A1 = "111111111111111111111111";
const SITE_A2 = "222222222222222222222222";
const SITE_B = "333333333333333333333333";
const ORDER_ID = "444444444444444444444444";

function query(value, session = false) {
  return {
    select() { return this; },
    session() {
      if (session) return Promise.resolve(value);
      return this;
    },
    async lean() { return value; }
  };
}

test("P0-04 HTTP: authenticated status and payment cannot cross companies or branches", async () => {
  const previousSecret = process.env.JWT_SECRET;
  const original = {
    pedidoFindById: Pedido.findById,
    pedidoUpdate: Pedido.findOneAndUpdate,
    restaurantFindOne: Restaurante.findOne,
    siteFindOne: Sede.findOne,
    startSession: mongoose.startSession
  };
  const writes = { status: 0, payment: 0, sessions: 0, notifications: [] };
  let currentOrder = null;
  let rejectAtomicUpdate = false;

  const a1 = { _id: SITE_A1, empresaId: COMPANY_A, restauranteId: "rest-a", codigoSede: "LOCAL-UNO" };
  const a2 = { _id: SITE_A2, empresaId: COMPANY_A, restauranteId: "rest-a", codigoSede: "LOCAL-DOS" };
  const b1 = { _id: SITE_B, empresaId: COMPANY_B, restauranteId: "rest-b", codigoSede: "LOCAL-B" };
  const sites = [a1, a2, b1];
  const restaurants = [
    { _id: "555555555555555555555555", empresaId: COMPANY_A, restaurantId: "rest-a" },
    { _id: "666666666666666666666666", empresaId: COMPANY_B, restaurantId: "rest-b" }
  ];

  Pedido.findById = (_id) => query(String(_id) === ORDER_ID ? currentOrder : null, true);
  Pedido.findOneAndUpdate = async (filter, values) => {
    // The mutation itself must stay scoped even if the order moves between
    // its initial authorization read and the write (TOCTOU).
    assert.equal(String(filter._id), ORDER_ID);
    assert.equal(String(filter.restaurantId), String(currentOrder.restaurantId));
    assert.equal(String(filter.empresaId), String(currentOrder.empresaId));
    assert.equal(String(filter.sedeId), String(currentOrder.sedeId));
    if (rejectAtomicUpdate) return null;
    writes.status++;
    return { ...currentOrder, ...values };
  };
  Restaurante.findOne = filter => query(restaurants.find(item =>
    String(item.empresaId) === String(filter.empresaId) &&
    item.restaurantId === filter.restaurantId) || null);
  Sede.findOne = filter => query(sites.find(item =>
    String(item.empresaId) === String(filter.empresaId) &&
    item.restauranteId === filter.restauranteId &&
    (item.codigoSede === filter.$or[0].codigoSede ||
      String(item._id) === String(filter.$or[1]._id))) || null);

  mongoose.startSession = async () => ({
    async withTransaction(callback) { await callback(); },
    async endSession() { writes.sessions++; }
  });

  const app = express();
  app.use(express.json());
  app.set("io", {
    to(room) {
      const rooms = [room];
      return {
        to(other) { rooms.push(other); return this; },
        emit(event) { writes.notifications.push({ event, rooms }); }
      };
    }
  });
  app.use("/api", apiRouter);
  const server = await new Promise(resolve => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });

  function token(company, site, role = "ADMIN_SEDE") {
    return jwt.sign({
      sub: "777777777777777777777777",
      empresaId: company,
      sedeId: site,
      rol: role,
      tokenVersion: 0
    }, SECRET, { algorithm: "HS256", expiresIn: "5m" });
  }
  async function request(route, tokenValue, body) {
    const response = await fetch("http://127.0.0.1:" + server.address().port + "/api" + route, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        ...(tokenValue ? { authorization: "Bearer " + tokenValue } : {})
      },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    return { status: response.status, data };
  }
  function order(tenant = COMPANY_A, restaurant = "rest-a", site = "LOCAL-UNO", paid = "pendiente") {
    return {
      _id: ORDER_ID, empresaId: tenant, restaurantId: restaurant, sedeId: site,
      estadoPago: paid, productoServicioId: "888888888888888888888888",
      cantidad: 1, precio: 100, precioUnitario: 100,
      async save() { writes.payment++; }
    };
  }
  try {
    process.env.JWT_SECRET = SECRET;
    const permitted = token(COMPANY_A, SITE_A1);
    const sibling = token(COMPANY_A, SITE_A2);
    const foreign = token(COMPANY_B, SITE_B);

    currentOrder = order();
    const allowed = await request("/pedido/" + ORDER_ID + "/estado", permitted, { estado: "listo" });
    assert.equal(allowed.status, 200, JSON.stringify(allowed.data));
    assert.equal(writes.status, 1);
    assert.equal(writes.notifications.length, 1);
    assert.deepEqual(writes.notifications[0].rooms, [
      "empresa-" + COMPANY_A,
      "empresa-" + COMPANY_A + "-sede-" + SITE_A1
    ]);
    writes.notifications.length = 0;

    // Simulate a concurrent transfer/correction between lookup and the
    // atomic write. No successful mutation or notification is allowed.
    rejectAtomicUpdate = true;
    const changed = await request("/pedido/" + ORDER_ID + "/estado", permitted, { estado: "entregado" });
    assert.equal(changed.status, 409, JSON.stringify(changed.data));
    assert.equal(writes.status, 1);
    assert.equal(writes.notifications.length, 0);
    rejectAtomicUpdate = false;

    for (const badToken of [sibling, foreign]) {
      const deniedStatus = await request("/pedido/" + ORDER_ID + "/estado", badToken, { estado: "entregado" });
      assert.equal(deniedStatus.status, 403);
      const deniedPayment = await request("/pedido/" + ORDER_ID + "/pago", badToken, { estadoPago: "pagado" });
      assert.equal(deniedPayment.status, 403);
    }
    assert.equal(writes.status, 1, "cross-tenant/site status cannot mutate");
    assert.equal(writes.payment, 0, "cross-tenant/site payment cannot persist");
    assert.equal(writes.notifications.length, 0, "denied requests cannot emit events");

    currentOrder = order(COMPANY_A, "rest-a", "");
    for (const route of ["/estado", "/pago"]) {
      const response = await request("/pedido/" + ORDER_ID + route, permitted,
        route === "/estado" ? { estado: "listo" } : { estadoPago: "pagado" });
      assert.equal(response.status, 403, "legacy siteless orders must deny branch staff");
    }
    assert.equal(writes.status, 1);
    assert.equal(writes.payment, 0);

    currentOrder = order(COMPANY_A, "rest-a", "LOCAL-UNO", "pagado");
    const replay = await request("/pedido/" + ORDER_ID + "/pago", permitted, { estadoPago: "pagado" });
    assert.equal(replay.status, 200, JSON.stringify(replay.data));
    assert.equal(writes.payment, 0, "already-paid replay must not create another payment");
    assert.deepEqual(writes.notifications[0].rooms, [
      "empresa-" + COMPANY_A,
      "empresa-" + COMPANY_A + "-sede-" + SITE_A1
    ]);

    const noToken = await request("/pedido/" + ORDER_ID + "/estado", null, { estado: "listo" });
    assert.equal(noToken.status, 401);
    const noRole = await request("/pedido/" + ORDER_ID + "/pago", token(COMPANY_A, SITE_A1, "EMPLEADO"), { estadoPago: "pagado" });
    assert.equal(noRole.status, 403);
    assert.equal(writes.payment, 0);
  } finally {
    await new Promise(resolve => server.close(resolve));
    Pedido.findById = original.pedidoFindById;
    Pedido.findOneAndUpdate = original.pedidoUpdate;
    Restaurante.findOne = original.restaurantFindOne;
    Sede.findOne = original.siteFindOne;
    mongoose.startSession = original.startSession;
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  }
});
