"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { resolveLlamadosScope } = require("../../core/realtime/llamadosTenant.service");

const empresaA = "aaaaaaaaaaaaaaaaaaaaaaaa";
const empresaB = "bbbbbbbbbbbbbbbbbbbbbbbb";
const siteA = "111111111111111111111111";
const siteB = "222222222222222222222222";
function query(value) { return { select() { return { lean: async () => value }; } }; }
const restaurants = {
  findOne(filter) {
    const allowed = (filter.restaurantId === "restA" && filter.empresaId === empresaA) ||
      (filter.restaurantId === "restB" && filter.empresaId === empresaB);
    return query(allowed ? { _id: "restaurant" } : null);
  }
};
const sites = {
  findOne(filter) {
    const allowed = filter.empresaId === empresaA && filter.restauranteId === "restA" &&
      filter.$or.some(x => x.codigoSede === "site-A" || x._id === siteA);
    return query(allowed ? { _id: siteA, codigoSede: "site-A" } : null);
  }
};
const deps = { RestauranteModel: restaurants, SedeModel: sites };
const owner = { empresaId: empresaA, rol: "DUEÑO", sedeId: null, restaurantId: null };
const staff = { empresaId: empresaA, rol: "EMPLEADO", sedeId: "site-A", restaurantId: "restA" };

test("P0-70: dueño solo consulta restaurantes persistidos de su empresa", async () => {
  assert.deepEqual(await resolveLlamadosScope(owner, "restA", deps), { restaurantId: "restA" });
  assert.equal(await resolveLlamadosScope(owner, "restB", deps), null);
  assert.equal(await resolveLlamadosScope({ ...owner, empresaId: empresaB }, "restA", deps), null);
});
test("P0-70: personal ve únicamente códigos y ObjectIds de su sede validada", async () => {
  assert.deepEqual(await resolveLlamadosScope(staff, "restA", deps), {
    restaurantId: "restA", sedeId: { $in: [siteA, "site-A"] }
  });
  assert.deepEqual(await resolveLlamadosScope({ ...staff, sedeId: siteA }, "restA", deps), {
    restaurantId: "restA", sedeId: { $in: [siteA, "site-A"] }
  });
});
test("P0-70: nunca autoriza otro restaurante, otra sede, usuario sin sede o claims inyectados", async () => {
  for (const auth of [
    { ...staff, restaurantId: "restB" },
    { ...staff, sedeId: siteB },
    { ...staff, sedeId: null },
    { ...staff, empresaId: empresaB },
    { ...staff, rol: "INVITADO" },
    { ...staff, sedeId: { $ne: null } },
    { ...owner, sedeId: "site-A" },
    { ...owner, empresaId: { $ne: null } }
  ]) assert.equal(await resolveLlamadosScope(auth, "restA", deps), null);
  for (const restaurantId of [null, "", "restA/../restB", { $ne: null }, ["restA"]])
    assert.equal(await resolveLlamadosScope(staff, restaurantId, deps), null);
});
test("P0-70: caída de Mongo no concede acceso por defecto", async () => {
  const broken = { findOne() { throw Error("MONGO_UNAVAILABLE"); } };
  await assert.rejects(resolveLlamadosScope(staff, "restA", {
    RestauranteModel: broken, SedeModel: sites
  }), /MONGO_UNAVAILABLE/);
  await assert.rejects(resolveLlamadosScope(staff, "restA", {
    RestauranteModel: restaurants, SedeModel: broken
  }), /MONGO_UNAVAILABLE/);
});
test("P0-70: GET y PUT de llamados tienen JWT y filtro Mongo antes de operar", () => {
  const root = path.join(__dirname, "../..");
  const api = fs.readFileSync(path.join(root, "routes/API.js"), "utf8");
  for (const endpoint of [
    'router.get("/llamados", ...seguridadLlamados',
    'router.get("/llamados/mesa/:mesa", ...seguridadLlamados',
    'router.put("/llamados/:id/atendiendo", ...seguridadLlamados',
    'router.put("/llamados/mesa/:mesa/atendido", ...seguridadLlamados',
    'router.get("/mesero/mesas", ...seguridadLlamados'
  ]) assert.ok(api.includes(endpoint), endpoint);
  assert.match(api, /resolveLlamadosScope\(req\.auth, restaurantId\)/);
  assert.match(api, /Llamado\.findOneAndUpdate\(\s*\{ \.\.\.req\.llamadosScope, _id: req\.params\.id/);
  assert.match(api, /Llamado\.findOneAndUpdate\(\s*\{\s*\.\.\.req\.llamadosScope,\s*mesa,/);
  assert.match(api, /Personal\.findOne\(\{ _id: meseroId, restaurantId \}\)/);
  assert.match(api, /Personal\.findOneAndUpdate\(\{\s*_id: llamado\.meseroId,\s*restaurantId: llamado\.restaurantId/);
  assert.doesNotMatch(api, /Llamado\.findByIdAndUpdate\(/);
});
test("P0-70: cliente mesero envía JWT en Socket.IO y solicitudes operativas", () => {
  const root = path.join(__dirname, "../..");
  const client = fs.readFileSync(path.join(root, "public/mesero.js"), "utf8");
  assert.match(client, /io\(\{ auth: \{ token: meseroToken \} \}\)/);
  assert.match(client, /Authorization: "Bearer " \+ meseroToken/);
  assert.match(client, /meseroAuthHeaders\(\)/);
  const html = fs.readFileSync(path.join(root, "public/mesero.html"), "utf8");
  assert.match(html, /localStorage\.getItem\("grukAuthToken"\)/);
});
