"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  joinTenantRealtimeRooms, emitRestaurantRealtime, ownerRoom, siteRoom, menuRoom
} = require("../../core/realtime/tenantRealtime.service");

const tenantA = "aaaaaaaaaaaaaaaaaaaaaaaa";
const tenantB = "bbbbbbbbbbbbbbbbbbbbbbbb";
const sedeA = "111111111111111111111111";
const sedeB = "222222222222222222222222";

function query(value) {
  return { select() { return { lean: async () => value }; } };
}
const restaurants = {
  findOne({ restaurantId }) {
    return query(restaurantId === "restA" ? { empresaId: tenantA } :
      restaurantId === "restB" ? { empresaId: tenantB } : null);
  }
};
const sites = {
  findOne(filter) {
    const known = [
      { empresaId: tenantA, restauranteId: "restA", id: sedeA, codigo: "site-A" },
      { empresaId: tenantB, restauranteId: "restB", id: sedeB, codigo: "site-B" }
    ];
    const match = known.find(x => String(filter.empresaId) === x.empresaId &&
      filter.restauranteId === x.restauranteId &&
      filter.$or.some(c => c._id === x.id || c.codigoSede === x.codigo));
    return query(match ? { _id: match.id } : null);
  }
};
function socket(auth) {
  const joined = [];
  return { auth: { usuarioId: "user-A", identityType: "USUARIO", tokenVersion: 2, expiresAt: 4102444800, ...auth }, joined, join(room) { joined.push(room); } };
}
function fakeIo() {
  const events = [];
  return {
    events,
    to(first) {
      const rooms = [first];
      const target = {
        to(room) { rooms.push(room); return target; },
        emit(event, payload) { events.push({ rooms: [...rooms], event, payload }); }
      };
      return target;
    }
  };
}
const deps = { RestauranteModel: restaurants, SedeModel: sites };

test("P0-70: dueño recibe solo room privado de su empresa y menú", async () => {
  const s = socket({ empresaId: tenantA, sedeId: null, rol: "DUEÑO" });
  assert.equal(await joinTenantRealtimeRooms(s, { SedeModel: sites, validateSession: async () => true }), 2);
  assert.deepEqual(s.joined, [ownerRoom(tenantA), menuRoom(tenantA)]);
  assert.equal(s.joined.some(x => x.includes(tenantB)), false);
});
test("P0-70: empleado recibe solo room de su sede validada, nunca owner", async () => {
  for (const sedeId of [sedeA, "site-A"]) {
    const s = socket({ empresaId: tenantA, sedeId, restaurantId: "restA", rol: "EMPLEADO" });
    assert.equal(await joinTenantRealtimeRooms(s, { SedeModel: sites, validateSession: async () => true }), 2);
    assert.deepEqual(s.joined, [siteRoom(tenantA, sedeA), menuRoom(tenantA)]);
    assert.equal(s.joined.includes(ownerRoom(tenantA)), false);
  }
});
test("P0-70: rechaza sede ajena, rol ajeno, claims sin scope y coerción", async () => {
  const invalid = [
    { empresaId: tenantA, sedeId: sedeB, restaurantId: "restA", rol: "EMPLEADO" },
    { empresaId: tenantA, sedeId: sedeA, restaurantId: "restB", rol: "ADMIN_SEDE" },
    { empresaId: tenantA, sedeId: null, restaurantId: "restA", rol: "EMPLEADO" },
    { empresaId: tenantA, sedeId: sedeA, restaurantId: null, rol: "EMPLEADO" },
    { empresaId: tenantA, sedeId: sedeA, restaurantId: "restA", rol: "INVITADO" },
    { empresaId: { $ne: null }, sedeId: null, rol: "DUEÑO" },
    { empresaId: tenantA, sedeId: { $ne: null }, restaurantId: "restA", rol: "EMPLEADO" }
  ];
  for (const auth of invalid) {
    const s = socket(auth);
    assert.equal(await joinTenantRealtimeRooms(s, { SedeModel: sites, validateSession: async () => true }), 0);
    assert.deepEqual(s.joined, []);
  }
});
test("P0-70: pedidos privados llegan a dueño y sede correctos, nunca a otros tenants", async () => {
  const io = fakeIo();
  const pedido = { restaurantId: "restA", sedeId: "site-A", producto: "Café" };
  assert.equal(await emitRestaurantRealtime(io, {
    restaurantId: "restA", sedeId: "site-A", event: "pedido:nuevo", payload: pedido
  }, deps), true);
  assert.deepEqual(io.events, [{
    rooms: [ownerRoom(tenantA), siteRoom(tenantA, sedeA)],
    event: "pedido:nuevo", payload: pedido
  }]);
  assert.equal(io.events[0].rooms.some(x => x.includes(tenantB)), false);
});
test("P0-70: pedidos legacy sin sede llegan únicamente al dueño", async () => {
  const io = fakeIo();
  const pedido = { restaurantId: "restA", sedeId: "" };
  assert.equal(await emitRestaurantRealtime(io, {
    restaurantId: "restA", sedeId: "", event: "pedido:actualizado", payload: pedido
  }, deps), true);
  assert.deepEqual(io.events[0].rooms, [ownerRoom(tenantA)]);
});
test("P0-70: rechaza evento con sede ajena, restaurante inexistente o payload alterado", async () => {
  const io = fakeIo();
  const invalid = [
    { restaurantId: "restA", sedeId: "site-B", event: "pedido:nuevo", payload: { restaurantId: "restA" } },
    { restaurantId: "restA", sedeId: { $ne: null }, event: "pedido:nuevo", payload: { restaurantId: "restA" } },
    { restaurantId: "restA", sedeId: "site-A", event: "pedido:nuevo", payload: { restaurantId: "restB" } },
    { restaurantId: "unknown", event: "pedido:nuevo", payload: { restaurantId: "unknown" } },
    { restaurantId: "restA", event: "secreto:todos", payload: { restaurantId: "restA" } },
    { restaurantId: "../restA", event: "pedido:nuevo", payload: { restaurantId: "../restA" } }
  ];
  for (const args of invalid) assert.equal(await emitRestaurantRealtime(io, args, deps), false);
  assert.equal(io.events.length, 0);
});
test("P0-70: menú emite solo identificador a sockets autorizados de la empresa", async () => {
  const io = fakeIo();
  assert.equal(await emitRestaurantRealtime(io, {
    restaurantId: "restA", event: "menu:actualizado",
    payload: { restaurantId: "restA", secret: "no-exponer", precio: 1000 }
  }, deps), true);
  assert.deepEqual(io.events, [{
    rooms: [menuRoom(tenantA)], event: "menu:actualizado", payload: { restaurantId: "restA" }
  }]);
});
test("P0-70: falla cerrado si consulta de tenant no está disponible", async () => {
  const io = fakeIo();
  const broken = { findOne() { throw Error("MONGO_UNAVAILABLE"); } };
  assert.equal(await emitRestaurantRealtime(io, {
    restaurantId: "restA", event: "pedido:nuevo", payload: { restaurantId: "restA" }
  }, { RestauranteModel: broken, SedeModel: sites }), false);
  assert.equal(io.events.length, 0);
});
test("P0-70: las rutas no emiten pedidos/llamados/menús globalmente", () => {
  const root = path.join(__dirname, "../..");
  for (const file of ["routes/API.js", "services/pagosPedidos.service.js"]) {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    assert.doesNotMatch(source, /\bio\.emit\s*\(/, file);
    assert.match(source, /emitRestaurantRealtime\(/, file);
  }
  const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
  assert.match(app, /joinTenantRealtimeRooms\(socket\)/);
  assert.doesNotMatch(app, /socket\.join\(\`empresa-/);
});
