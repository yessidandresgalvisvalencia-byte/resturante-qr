"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  issueToken, verifyToken, issueMesaQr, resolveMesaQrRead, MAX_AGE_SECONDS
} = require("../../core/security/qrMesaRead.service");

const secret = "qr-capability-test-secret-32-bytes-minimum-0123456789";
const now = () => 1_800_000_000_000;
const empresa = "aaaaaaaaaaaaaaaaaaaaaaaa";
const otherEmpresa = "bbbbbbbbbbbbbbbbbbbbbbbb";
const siteA = "111111111111111111111111";
const siteB = "222222222222222222222222";
const restaurantId = "restA";
const owner = { empresaId: empresa, rol: "DUEÑO", sedeId: null };
const adminA = { empresaId: empresa, rol: "ADMIN_SEDE", sedeId: siteA };
const args = { empresaId: empresa, restaurantId, mesa: 7, sedeId: siteA };
function chain(value) { return { select() { return { lean: async () => value }; } }; }
function models() {
  const calls = [];
  return {
    calls,
    RestauranteModel: { findOne(filter) {
      calls.push({ type: "restaurant", filter });
      return chain(filter.empresaId === empresa && filter.restaurantId === restaurantId
        ? { _id: "restaurant-A" } : null);
    } },
    SedeModel: { findOne(filter) {
      calls.push({ type: "site", filter });
      return chain(filter.empresaId === empresa && filter.restauranteId === restaurantId &&
        (filter._id === siteA || filter.$or?.some(x => x._id === siteA || x.codigoSede === "site-A"))
        ? { _id: siteA, codigoSede: "site-A" } : null);
    } }
  };
}
function token(site = siteA) {
  const issued = issueToken({ ...args, sedeId: site }, { secret, now });
  assert.equal(issued.status, 200);
  return issued.token;
}

test("P0-70: HMAC de mesa/sede/empresa es íntegro, temporal y fail-closed", () => {
  const t = token();
  assert.equal(verifyToken(t, { secret, now }).status, 200);
  assert.equal(verifyToken(t + "x", { secret, now }).status, 401);
  const [payload, signature] = t.split(".");
  const forged = Buffer.from(JSON.stringify({
    ...JSON.parse(Buffer.from(payload, "base64url").toString("utf8")), m: 8
  })).toString("base64url") + "." + signature;
  assert.equal(verifyToken(forged, { secret, now }).status, 401);
  assert.equal(verifyToken(t, { secret, now: () => now() + (MAX_AGE_SECONDS + 1) * 1000 }).status, 401);
  assert.equal(verifyToken(t, { secret: "short", now }).status, 503);
  assert.equal(verifyToken(undefined, { secret, now }).status, 401);
  assert.equal(issueToken({ ...args, empresaId: otherEmpresa }, { secret: "short", now }).status, 503);
});

test("P0-70: token solo lee mesa y sede autorizadas con consulta tenant persistida", async () => {
  const m = models();
  const options = { ...m, secret, now };
  const authorized = await resolveMesaQrRead({
    restaurantId, mesa: 7, sedeId: "site-A", qrToken: token()
  }, options);
  assert.equal(authorized.status, 200);
  assert.deepEqual(authorized.filter, {
    restaurantId, mesa: 7, sedeId: { $in: [siteA, "site-A"] }
  });
  for (const input of [
    { restaurantId, mesa: 8, qrToken: token() },
    { restaurantId: "restB", mesa: 7, qrToken: token() },
    { restaurantId, mesa: 7, sedeId: siteB, qrToken: token() },
    { restaurantId, mesa: 7, qrToken: token(siteB) },
    { restaurantId, mesa: 7, qrToken: "" },
    { restaurantId, mesa: { $ne: 0 }, qrToken: token() }
  ]) {
    const result = await resolveMesaQrRead(input, options);
    assert.notEqual(result.status, 200);
    assert.equal(Object.hasOwn(result, "filter"), false);
  }
  const foreign = issueToken({ ...args, empresaId: otherEmpresa }, { secret, now });
  const forbidden = await resolveMesaQrRead({
    restaurantId, mesa: 7, qrToken: foreign.token
  }, options);
  assert.equal(forbidden.status, 403);
  assert.ok(m.calls.some(x => x.type === "restaurant" && x.filter.empresaId === otherEmpresa));
});

test("P0-70: QR legado solo lee documentos sin sede, nunca pedidos de otras sedes", async () => {
  const m = models();
  const result = await resolveMesaQrRead({
    restaurantId, mesa: 7, qrToken: token("")
  }, { ...m, secret, now });
  assert.equal(result.status, 200);
  assert.deepEqual(result.filter, {
    restaurantId, mesa: 7, sedeId: { $in: ["", null] }
  });
  const denied = await resolveMesaQrRead({
    restaurantId, mesa: 7, sedeId: "site-A", qrToken: token("")
  }, { ...m, secret, now });
  assert.equal(denied.status, 403);
});

test("P0-70: solo emite QR de sede si el rol y Mongo lo autorizan", async () => {
  const m = models();
  const resolveScope = async ({ auth }) => ({
    status: 200,
    filter: auth.rol === "DUEÑO" ? { restaurantId } :
      { restaurantId, sedeId: { $in: [siteA, "site-A"] } }
  });
  const options = { ...m, resolveScope, secret, now };
  const issued = await issueMesaQr({
    auth: adminA, restaurantId, mesa: 7, sedeId: "site-A"
  }, options);
  assert.equal(issued.status, 200);
  assert.equal(issued.sedeId, siteA);
  assert.equal(verifyToken(issued.token, { secret, now }).payload.s, siteA);
  assert.equal((await issueMesaQr({
    auth: adminA, restaurantId, mesa: 7
  }, options)).status, 403);
  assert.equal((await issueMesaQr({
    auth: adminA, restaurantId, mesa: 7, sedeId: siteB
  }, options)).status, 403);
  assert.equal((await issueMesaQr({
    auth: owner, restaurantId, mesa: 7
  }, options)).status, 200);
  assert.equal((await issueMesaQr({
    auth: { ...owner, empresaId: otherEmpresa }, restaurantId, mesa: 7
  }, { ...options, resolveScope: async () => ({ status: 403, error: "forbidden" }) })).status, 403);
});

test("P0-70: rutas QR, factura, pedidos y pago no aceptan lecturas públicas sin capacidad", () => {
  const api = fs.readFileSync(path.join(__dirname, "../../routes/API.js"), "utf8");
  const payments = fs.readFileSync(path.join(__dirname, "../../routes/pagos.js"), "utf8");
  const ui = fs.readFileSync(path.join(__dirname, "../../public/script.js"), "utf8");
  const html = fs.readFileSync(path.join(__dirname, "../../public/index.html"), "utf8");
  const orders = api.slice(api.indexOf('router.get("/pedidos/mesa/:mesa"'),
    api.indexOf('router.put("/pedido/:id/estado"'));
  const bill = api.slice(api.indexOf('router.get("/factura/mesa/:mesa"'),
    api.indexOf('function qrPublicOrigin()'));
  assert.match(orders, /resolveMesaQrRead\(/);
  assert.match(bill, /resolveMesaQrRead\(/);
  assert.match(orders, /Pedido\.find\(scope\.filter\)/);
  assert.match(bill, /Pedido\.find\(scope\.filter\)/);
  assert.match(api, /router\.get\("\/qr\/:mesa", authMiddleware/);
  assert.match(api, /router\.get\("\/qr-sede\/:mesa", authMiddleware/);
  assert.match(payments, /resolveMesaQrRead\(/);
  assert.match(payments, /\.\.\.scope\.filter/);
  assert.match(ui, /qrToken/);
  assert.match(ui, /escapeMesaText\(p\.observaciones\)/);
  assert.match(html, /qrToken/);
  assert.match(html, /name="referrer" content="no-referrer"/);
  assert.doesNotMatch(ui, /const socket = io\(\)/);
});
