"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { resolvePedidoListadoScope } = require("../../core/security/pedidoListadoTenant.service");
const { resolveLlamadosScope } = require("../../core/realtime/llamadosTenant.service");

const empresa = "aaaaaaaaaaaaaaaaaaaaaaaa";
const otraEmpresa = "bbbbbbbbbbbbbbbbbbbbbbbb";
const sedeA = "111111111111111111111111";
const sedeB = "222222222222222222222222";
const owner = { empresaId: empresa, rol: "DUEÑO", sedeId: null, restaurantId: null };
const adminA = { empresaId: empresa, rol: "ADMIN_SEDE", sedeId: sedeA, restaurantId: "restA" };
const adminB = { empresaId: empresa, rol: "ADMIN_SEDE", sedeId: sedeB, restaurantId: "restA" };
function query(value) { return { select() { return { lean: async () => value }; } }; }
function harness() {
  const calls = [];
  const RestauranteModel = { findOne(filter) {
    calls.push({ type: "restaurant", filter });
    return query(filter.empresaId === empresa && filter.restaurantId === "restA" ? { _id: "restaurantA" } : null);
  } };
  const SedeModel = { findOne(filter) {
    calls.push({ type: "sede", filter });
    const id = filter.$or?.find(v => v._id === sedeA || v._id === sedeB)?._id;
    return query(filter.empresaId === empresa && filter.restauranteId === "restA" && id
      ? { _id: id, codigoSede: id === sedeA ? "site-A" : "site-B" } : null);
  } };
  return { calls, resolveScope: (auth, restaurantId) =>
    resolveLlamadosScope(auth, restaurantId, { RestauranteModel, SedeModel }) };
}
test("P0-70: sede A y B tienen predicados de lectura disjuntos", async () => {
  const h = harness();
  const a = await resolvePedidoListadoScope({ auth: adminA, restaurantId: "restA" }, h);
  const b = await resolvePedidoListadoScope({ auth: adminB, restaurantId: "restA" }, h);
  assert.equal(a.status, 200); assert.equal(b.status, 200);
  assert.deepEqual(a.filter, { restaurantId: "restA", sedeId: { $in: [sedeA, "site-A"] } });
  assert.deepEqual(b.filter, { restaurantId: "restA", sedeId: { $in: [sedeB, "site-B"] } });
  assert.equal(a.filter.sedeId.$in.some(x => b.filter.sedeId.$in.includes(x)), false);
  assert.equal(a.filter.sedeId.$in.includes(""), false);
});
test("P0-70: dueño ve su restaurante, nunca otro tenant", async () => {
  const h = harness();
  assert.deepEqual(await resolvePedidoListadoScope({ auth: owner, restaurantId: "restA" }, h),
    { status: 200, filter: { restaurantId: "restA" } });
  for (const auth of [{ ...owner, empresaId: otraEmpresa }, { ...adminA, empresaId: otraEmpresa },
    { ...adminA, restaurantId: "restB" }, { ...adminA, sedeId: null },
    { ...owner, sedeId: sedeA }, { ...adminA, sedeId: { $ne: null } }]) {
    const r = await resolvePedidoListadoScope({ auth, restaurantId: "restA" }, h);
    assert.equal(r.status, 403);
    assert.equal(Object.hasOwn(r, "filter"), false);
  }
});
test("P0-70: filtros query no son autoridad y entrada maliciosa falla cerrada", async () => {
  const h = harness();
  for (const restaurantId of [undefined, "", "rest A", { $ne: null }, ["restA"], "x".repeat(121)]) {
    const r = await resolvePedidoListadoScope({ auth: adminA, restaurantId }, h);
    assert.equal(r.status, 400);
    assert.equal(Object.hasOwn(r, "filter"), false);
  }
  const evil = await resolvePedidoListadoScope({ auth: adminA, restaurantId: "restA" }, {
    resolveScope: async () => ({ restaurantId: "restA", sedeId: { $ne: "" } })
  });
  assert.equal(evil.status, 403);
  assert.equal(Object.hasOwn(evil, "filter"), false);
});
test("P0-70: indisponibilidad de Mongo no autoriza listado", async () => {
  await assert.rejects(resolvePedidoListadoScope({ auth: adminA, restaurantId: "restA" }, {
    resolveScope: async () => { throw Error("MONGO_DOWN"); }
  }), /MONGO_DOWN/);
});
test("P0-70: rutas GET privadas usan predicado Mongo antes de serializar", () => {
  const source = fs.readFileSync(path.join(__dirname, "../../routes/API.js"), "utf8");
  const list = source.slice(source.indexOf('router.get("/pedidos",'), source.indexOf('router.get("/pedidos/mesa/:mesa"'));
  assert.match(list, /authMiddleware/);
  assert.match(list, /roleCheck\(ROLES_GRUK\.DUENO, ROLES_GRUK\.ADMIN_SEDE, ROLES_GRUK\.EMPLEADO\)/);
  assert.match(list, /resolvePedidoListadoScope\(/);
  assert.match(list, /Pedido\.find\(scope\.filter\)/);
  assert.doesNotMatch(list, /Pedido\.find\(\{\s*restaurantId\s*\}\)/);
  const summary = source.slice(source.indexOf('router.get(\n  "/admin/resumen",'), source.indexOf('router.post("/admin/registro"'));
  assert.match(summary, /authMiddleware/);
  assert.match(summary, /resolvePedidoListadoScope\(/);
  assert.match(summary, /Pedido\.find\(scope\.filter\)/);
  assert.doesNotMatch(summary, /Pedido\.find\(\{\s*restaurantId\s*\}\)/);
});
test("P0-70: interfaces de mesero y cocina autentican lecturas; cocina escapa HTML", () => {
  const waiter = fs.readFileSync(path.join(__dirname, "../../public/mesero.js"), "utf8");
  const kitchen = fs.readFileSync(path.join(__dirname, "../../public/cocina.js"), "utf8");
  assert.match(waiter, /headers: meseroAuthHeaders\(\)/);
  assert.match(kitchen, /headers: cocinaAuthHeaders\(\)/);
  assert.match(kitchen, /const socket = io\(\{ auth: \{ token: cocinaToken \} \}\)/);
  assert.match(kitchen, /function escapeHtml\(value\)/);
  assert.match(kitchen, /escapeHtml\(pedido\.observaciones/);
  assert.match(kitchen, /if \(!\/\^\[a-f0-9\]\{24\}\$\/i\.test\(String\(pedido\._id\)\)\) return/);
});
