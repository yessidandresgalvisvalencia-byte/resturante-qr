"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { resolvePedidoPagoScope } = require("../../core/security/pedidoPagoTenant.service");
const { resolveLlamadosScope } = require("../../core/realtime/llamadosTenant.service");

const empresaA = "aaaaaaaaaaaaaaaaaaaaaaaa";
const empresaB = "bbbbbbbbbbbbbbbbbbbbbbbb";
const sedeA = "111111111111111111111111";
const sedeB = "222222222222222222222222";
const pedidoId = "507f1f77bcf86cd799439011";
const owner = { empresaId: empresaA, rol: "DUEÑO", sedeId: null, restaurantId: null };
const adminA = { empresaId: empresaA, rol: "ADMIN_SEDE", sedeId: sedeA, restaurantId: "restA" };
const adminB = { empresaId: empresaA, rol: "ADMIN_SEDE", sedeId: sedeB, restaurantId: "restA" };

function query(value) { return { select() { return { lean: async () => value }; } }; }
function harness(locator = { restaurantId: "restA" }) {
  const calls = [];
  const PedidoModel = { findById(id) { calls.push({ op: "locator", id }); return query(id === pedidoId ? locator : null); } };
  const RestauranteModel = { findOne(filter) {
    calls.push({ op: "restaurant", filter });
    return query(filter.restaurantId === "restA" && filter.empresaId === empresaA ? { _id: "restMongoA" } : null);
  } };
  const SedeModel = { findOne(filter) {
    calls.push({ op: "site", filter });
    const selected = filter.$or.find(x => x._id === sedeA || x._id === sedeB);
    const valid = filter.empresaId === empresaA && filter.restauranteId === "restA" && selected;
    return query(valid ? { _id: selected._id, codigoSede: selected._id === sedeA ? "site-A" : "site-B" } : null);
  } };
  const resolveScope = (auth, restaurantId) => resolveLlamadosScope(auth, restaurantId, { RestauranteModel, SedeModel });
  return { calls, deps: { PedidoModel, resolveScope } };
}

test("P0-70: admin de sede solo obtiene filtro Mongo para sus pedidos", async () => {
  const h = harness();
  const result = await resolvePedidoPagoScope({ pedidoId, auth: adminA }, h.deps);
  assert.equal(result.status, 200);
  assert.deepEqual(result.filter, { _id: pedidoId, restaurantId: "restA", sedeId: { $in: [sedeA, "site-A"] } });
  assert.equal(h.calls.filter(x => x.op === "site").length, 1);
  // El predicado no incluye pedidos de otra sede aunque compartan restaurante.
  assert.equal(result.filter.sedeId.$in.includes(sedeB), false);
  assert.equal(result.filter.sedeId.$in.includes(""), false);
});

test("P0-70: admin de otra sede no puede seleccionar pedido de sede A", async () => {
  const h = harness();
  const result = await resolvePedidoPagoScope({ pedidoId, auth: adminB }, h.deps);
  assert.equal(result.status, 200); // No se divulga la sede en el locator.
  assert.deepEqual(result.filter.sedeId.$in, [sedeB, "site-B"]);
  const actualOrder = { _id: pedidoId, restaurantId: "restA", sedeId: sedeA };
  assert.equal(result.filter.sedeId.$in.includes(actualOrder.sedeId), false);
});

test("P0-70: dueño puede pagar pedidos legacy de su restaurante sin ampliar tenant", async () => {
  const h = harness();
  const result = await resolvePedidoPagoScope({ pedidoId, auth: owner }, h.deps);
  assert.deepEqual(result, { status: 200, filter: { _id: pedidoId, restaurantId: "restA" } });
  assert.equal(h.calls.filter(x => x.op === "site").length, 0);
});

test("P0-70: empresa ajena, restaurante ajeno y claims de sede inválidos fallan cerrados", async () => {
  for (const auth of [
    { ...owner, empresaId: empresaB },
    { ...adminA, empresaId: empresaB },
    { ...adminA, restaurantId: "restB" },
    { ...adminA, sedeId: null },
    { ...adminA, sedeId: { $ne: null } },
    { ...owner, sedeId: sedeA }
  ]) {
    const h = harness();
    const result = await resolvePedidoPagoScope({ pedidoId, auth }, h.deps);
    assert.equal(result.status, 403);
    assert.equal(Object.hasOwn(result, "filter"), false);
  }
});

test("P0-70: IDs inválidos y pedido inexistente no habilitan transacción", async () => {
  for (const bad of ["", "invalid", { $ne: null }, "507f1f77bcf86cd799439011x"]) {
    const h = harness();
    const result = await resolvePedidoPagoScope({ pedidoId: bad, auth: adminA }, h.deps);
    assert.equal(result.status, 400);
    assert.equal(h.calls.length, 0);
  }
  const h = harness(null);
  assert.equal((await resolvePedidoPagoScope({ pedidoId, auth: owner }, h.deps)).status, 404);
});

test("P0-70: errores Mongo no convierten denegación en autorización", async () => {
  const h = harness();
  await assert.rejects(resolvePedidoPagoScope({ pedidoId, auth: adminA }, {
    PedidoModel: h.deps.PedidoModel,
    resolveScope: async () => { throw Error("MONGO_UNAVAILABLE"); }
  }), /MONGO_UNAVAILABLE/);
});

test("P0-70: ruta de pago valida sede en filtro transaccional antes de venta", () => {
  const source = fs.readFileSync(path.join(__dirname, "../../routes/API.js"), "utf8");
  const start = source.indexOf('router.put("/pedido/:id/pago"');
  const end = source.indexOf("/* =========================\n   LLAMADOS", start);
  assert.ok(start >= 0 && end > start);
  const route = source.slice(start, end);
  assert.match(route, /authMiddleware, roleCheck\(ROLES_GRUK\.DUENO, ROLES_GRUK\.ADMIN_SEDE\)/);
  assert.match(route, /await resolvePedidoPagoScope\(\{ pedidoId: req\.params\.id, auth: req\.auth \}\)/);
  assert.match(route, /if \(scopePago\.status !== 200\)/);
  assert.match(route, /await session\.withTransaction\(/);
  assert.match(route, /await Pedido\.findOne\(scopePago\.filter\)\.session\(session\)/);
  assert.doesNotMatch(route, /Pedido\.findById\(req\.params\.id\)\.session\(session\)/);
  assert.ok(route.indexOf("Pedido.findOne(scopePago.filter)") < route.indexOf("registrarVentaDesdePedido("));
  assert.match(route, /if \(!sede\) \{/);
  assert.match(route, /SEDE_PAGO_NO_VERIFICADA/);
  assert.match(route, /await pedido\.save\(\{ session \}\)/);
  assert.match(route, /if \(ventaPostCommit\) emitirVentaCompletada\(ventaPostCommit\)/);
});
