"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { issueToken, resolveMesaQrRead } = require("../../core/security/qrMesaRead.service");

const empresa = "aaaaaaaaaaaaaaaaaaaaaaaa";
const sede = "111111111111111111111111";
const secret = "test-order-qr-scope-secret-32-bytes-minimum-123";
const now = () => 1_800_000_000_000;
const query = value => ({ select() { return { lean: async () => value }; } });
const models = {
  RestauranteModel: {
    findOne(filter) {
      return query(filter.empresaId === empresa && filter.restaurantId === "restA"
        ? { _id: "restaurantA" } : null);
    }
  },
  SedeModel: {
    findOne(filter) {
      return query(filter.empresaId === empresa && filter._id === sede &&
        filter.restauranteId === "restA"
        ? { _id: sede, codigoSede: "site-A" } : null);
    }
  }
};

test("P0-70: validated QR scope exposes persisted tenant and canonical site", async () => {
  const issued = issueToken({
    empresaId: empresa, restaurantId: "restA", mesa: 7, sedeId: sede
  }, { secret, now });
  assert.equal(issued.status, 200);
  const input = { restaurantId: "restA", mesa: 7, sedeId: "site-A", qrToken: issued.token };
  const verified = await resolveMesaQrRead(input, { ...models, secret, now });
  assert.equal(verified.status, 200);
  assert.equal(verified.empresaId, empresa);
  assert.equal(verified.canonicalSedeId, sede);
  assert.deepEqual(verified.filter, {
    empresaId: empresa, restaurantId: "restA", mesa: 7, sedeId: { $in: [sede, "site-A"] }
  });
  for (const invalid of [
    { ...input, mesa: 8 },
    { ...input, restaurantId: "restB" },
    { ...input, sedeId: "other-site" },
    { ...input, qrToken: "" }
  ]) {
    const denied = await resolveMesaQrRead(invalid, { ...models, secret, now });
    assert.notEqual(denied.status, 200);
    assert.equal(Object.hasOwn(denied, "empresaId"), false);
  }
});

test("P0-70: public order route validates QR before DB reads and persists canonical scope", () => {
  const api = fs.readFileSync(path.join(__dirname, "../../routes/API.js"), "utf8");
  const client = fs.readFileSync(path.join(__dirname, "../../public/script.js"), "utf8");
  const start = api.indexOf('router.post("/pedido", async (req, res) => {');
  const end = api.indexOf('router.get("/pedidos", authMiddleware', start);
  assert.ok(start >= 0 && end > start);
  const route = api.slice(start, end);
  const guard = route.indexOf("await resolveMesaQrRead(");
  const menuRead = route.indexOf("await Menu.findOne(");
  const write = route.indexOf("const pedido = new Pedido({");
  assert.ok(guard > 0 && menuRead > guard && write > menuRead);
  assert.match(route, /qrToken,/);
  assert.match(route, /restaurantId, empresaId: qrScope\.empresaId/);
  assert.match(route, /empresaId: qrScope\.empresaId/);
  assert.match(route, /sedeId: qrScope\.canonicalSedeId/);
  assert.doesNotMatch(route, /sedeId:\s*typeof sedeId/);
  const sendStart = client.indexOf("async function enviarPedidoAlServidor(");
  const sendEnd = client.indexOf("function obtenerProductosRecomendados(", sendStart);
  assert.ok(sendStart >= 0 && sendEnd > sendStart);
  assert.match(client.slice(sendStart, sendEnd), /qrToken,/);
});
