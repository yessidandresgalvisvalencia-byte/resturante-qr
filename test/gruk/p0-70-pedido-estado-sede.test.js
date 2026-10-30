"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { updatePedidoEstado, validEstimatedMinutes } =
  require("../../core/security/pedidoEstadoTenant.service");
const { resolveLlamadosScope } =
  require("../../core/realtime/llamadosTenant.service");

const empresaA = "aaaaaaaaaaaaaaaaaaaaaaaa";
const empresaB = "bbbbbbbbbbbbbbbbbbbbbbbb";
const sedeA = "111111111111111111111111";
const sedeB = "222222222222222222222222";
const pedidoId = "507f1f77bcf86cd799439011";
const owner = { empresaId: empresaA, rol: "DUEÑO", sedeId: null, restaurantId: null };
const staffA = { empresaId: empresaA, rol: "EMPLEADO", sedeId: sedeA, restaurantId: "restA" };
const staffB = { empresaId: empresaA, rol: "EMPLEADO", sedeId: sedeB, restaurantId: "restA" };

function query(value) { return { select() { return { lean: async () => value }; } }; }
function makeHarness(order = { _id: pedidoId, restaurantId: "restA", sedeId: sedeA }) {
  const calls = [];
  const restaurants = { findOne(filter) {
    return query(filter.restaurantId === "restA" && filter.empresaId === empresaA ? { _id: "restMongoA" } : null);
  }};
  const sites = { findOne(filter) {
    const matched = filter.empresaId === empresaA && filter.restauranteId === "restA" &&
      filter.$or.some(x => x._id === sedeA || x._id === sedeB);
    const site = filter.$or.find(x => x._id === sedeA || x._id === sedeB);
    return query(matched ? { _id: site._id, codigoSede: site._id === sedeA ? "site-A" : "site-B" } : null);
  }};
  const PedidoModel = {
    findById(id) {
      calls.push({ op: "read", id });
      return query(id === pedidoId ? { restaurantId: order.restaurantId } : null);
    },
    async findOneAndUpdate(filter, update, options) {
      calls.push({ op: "write", filter, update, options });
      if (filter._id !== order._id || filter.restaurantId !== order.restaurantId ||
          (filter.sedeId && !filter.sedeId.$in.includes(order.sedeId))) return null;
      return { ...order, ...update.$set };
    }
  };
  const resolveScope = (auth, restaurantId) => resolveLlamadosScope(auth, restaurantId, {
    RestauranteModel: restaurants, SedeModel: sites
  });
  return { calls, deps: { PedidoModel, resolveScope } };
}

test("P0-70: empleado de la sede correcta actualiza con predicado Mongo atómico", async () => {
  const h = makeHarness();
  const result = await updatePedidoEstado({
    pedidoId, auth: staffA, estado: "listo", tiempoEstimado: 12
  }, h.deps);
  assert.equal(result.status, 200);
  assert.equal(result.pedido.estado, "listo");
  const write = h.calls.find(c => c.op === "write");
  assert.deepEqual(write.filter, {
    _id: pedidoId, restaurantId: "restA", sedeId: { $in: [sedeA, "site-A"] }
  });
  assert.deepEqual(write.update, { $set: { estado: "listo", tiempoEstimado: 12 } });
  assert.deepEqual(write.options, { new: true, runValidators: true });
});

test("P0-70: otra sede no modifica pedido aunque pertenezca a la misma empresa", async () => {
  const h = makeHarness();
  const result = await updatePedidoEstado({ pedidoId, auth: staffB, estado: "entregado" }, h.deps);
  assert.equal(result.status, 404);
  assert.equal(h.calls.filter(c => c.op === "write").length, 1);
  assert.deepEqual(h.calls.find(c => c.op === "write").filter.sedeId.$in, [sedeB, "site-B"]);
});

test("P0-70: otro tenant, otro restaurante y usuario sin sede no escriben", async () => {
  for (const auth of [
    { ...staffA, empresaId: empresaB },
    { ...staffA, restaurantId: "restB" },
    { ...staffA, sedeId: null },
    { ...owner, empresaId: empresaB },
    { ...owner, sedeId: sedeA }
  ]) {
    const h = makeHarness();
    const result = await updatePedidoEstado({ pedidoId, auth, estado: "listo" }, h.deps);
    assert.equal(result.status, 403);
    assert.equal(h.calls.some(c => c.op === "write"), false);
  }
});

test("P0-70: pedido legacy sin sede no se entrega a empleados de sede", async () => {
  const h = makeHarness({ _id: pedidoId, restaurantId: "restA", sedeId: "" });
  const result = await updatePedidoEstado({ pedidoId, auth: staffA, estado: "listo" }, h.deps);
  assert.equal(result.status, 404);
  const ownerResult = await updatePedidoEstado({ pedidoId, auth: owner, estado: "listo" }, h.deps);
  assert.equal(ownerResult.status, 200);
});

test("P0-70: dueño puede operar pedido de su empresa, no de otra", async () => {
  const h = makeHarness();
  const result = await updatePedidoEstado({ pedidoId, auth: owner, estado: "entregado" }, h.deps);
  assert.equal(result.status, 200);
  assert.deepEqual(h.calls.find(c => c.op === "write").filter, { _id: pedidoId, restaurantId: "restA" });
});

test("P0-70: IDs, estados y tiempos inválidos se rechazan sin consultar Mongo", async () => {
  for (const bad of [
    { pedidoId: { $ne: null }, estado: "listo" },
    { pedidoId: "abc", estado: "listo" },
    { pedidoId, estado: { $ne: null } },
    { pedidoId, estado: "pagado" },
    { pedidoId, estado: "listo", tiempoEstimado: -1 },
    { pedidoId, estado: "listo", tiempoEstimado: Infinity },
    { pedidoId, estado: "listo", tiempoEstimado: "1e4" },
    { pedidoId, estado: "listo", tiempoEstimado: "9007199254740992" }
  ]) {
    const h = makeHarness();
    const result = await updatePedidoEstado({ ...bad, auth: staffA }, h.deps);
    assert.equal(result.status, 400);
    assert.equal(h.calls.length, 0);
  }
  assert.equal(validEstimatedMinutes("15"), true);
  assert.equal(validEstimatedMinutes("0015"), false);
});

test("P0-70: ausencia de pedido o caída de Mongo no habilita escritura", async () => {
  const h = makeHarness();
  assert.equal((await updatePedidoEstado({ pedidoId: "aaaaaaaaaaaaaaaaaaaaaaaa", auth: owner, estado: "listo" }, h.deps)).status, 404);
  assert.equal(h.calls.some(c => c.op === "write"), false);
  await assert.rejects(updatePedidoEstado({ pedidoId, auth: owner, estado: "listo" }, {
    PedidoModel: h.deps.PedidoModel,
    resolveScope: async () => { throw Error("MONGO_UNAVAILABLE"); }
  }), /MONGO_UNAVAILABLE/);
});

test("P0-70: ruta HTTP exige JWT, delega a scope y emite solo después del update", () => {
  const src = fs.readFileSync(path.join(__dirname, "../../routes/API.js"), "utf8");
  const route = src.slice(src.indexOf('router.put("/pedido/:id/estado"'), src.indexOf('router.put("/pedido/:id/pago"'));
  assert.match(route, /authMiddleware, roleCheck\(/);
  assert.match(route, /await updatePedidoEstado\(/);
  assert.match(route, /if \(resultado.status !== 200\)/);
  assert.match(route, /await emitRestaurantRealtime\(io/);
  assert.doesNotMatch(route, /findByIdAndUpdate/);
});
