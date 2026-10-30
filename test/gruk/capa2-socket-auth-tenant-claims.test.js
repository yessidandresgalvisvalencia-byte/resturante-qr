"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const jwt = require("jsonwebtoken");
const { extractSocketToken, authenticateSocketHandshake } =
  require("../../core/auth/socketAuth.service");

const secret = "gruk-test-socket-auth-secret-not-production";
const valid = Object.freeze({
  sub: "usuario-A", empresaId: "empresa-A", sedeId: "sede-A",
  rol: "EMPLEADO", tokenVersion: 3, identityType: "PERSONAL"
});
const sign = (payload, algorithm = "HS256") => jwt.sign(payload, secret, { algorithm, expiresIn: "8h" });
const handshake = token => ({ auth: { token } });

test("socket: acepta JWT HS256 canónico, raw o Bearer, y conserva identidad congelada", async () => {
  const token = sign(valid);
  let checked = 0;
  for (const supplied of [token, "Bearer " + token, "bearer\t" + token]) {
    const auth = await authenticateSocketHandshake(handshake(supplied), secret, async payload => {
      checked++;
      assert.equal(payload.empresaId, "empresa-A");
      return true;
    });
    assert.deepEqual({ ...auth }, {
      usuarioId: "usuario-A", empresaId: "empresa-A", sedeId: "sede-A",
      restaurantId: null, rol: "EMPLEADO", identityType: "PERSONAL", tokenVersion: 3,
      expiresAt: jwt.decode(token).exp
    });
    assert.equal(Object.isFrozen(auth), true);
  }
  assert.equal(checked, 3);
});

test("socket: rechaza tokens mal formados sin coerción de objetos", async () => {
  let coercions = 0;
  const malicious = { toString() { coercions++; return sign(valid); } };
  for (const token of [null, undefined, "", 1, true, [], malicious, "Bearer ",
    "Bearer " + "a".repeat(9000), sign(valid) + " another"]) {
    assert.equal(extractSocketToken(handshake(token)), null);
    await assert.rejects(authenticateSocketHandshake(handshake(token), secret, async () => true),
      /UNAUTHORIZED/);
  }
  for (const auth of [null, [], "", { token: sign(valid) }]) {
    const h = { auth };
    if (auth && !Array.isArray(auth) && typeof auth === "object") continue;
    assert.equal(extractSocketToken(h), null);
  }
  assert.equal(coercions, 0);
});

test("socket: bloquea claims falsificadas antes de consultar sesión", async () => {
  let checks = 0;
  const check = async () => { checks++; return true; };
  const cases = [
    { empresaId: { $ne: null } }, { empresaId: "empresa B" },
    { empresaId: "empresa-A/../../otro" }, { empresaId: "" },
    { sedeId: { $ne: null } }, { sedeId: [] }, { sedeId: "sede B" },
    { rol: "ADMIN" }, { rol: ["EMPLEADO"] }, { sub: {} },
    { tokenVersion: "3" }, { tokenVersion: -1 }, { tokenVersion: null },
    { identityType: [] }
  ];
  for (const overrides of cases) {
    const token = sign({ ...valid, ...overrides });
    await assert.rejects(authenticateSocketHandshake(handshake(token), secret, check),
      /UNAUTHORIZED/, JSON.stringify(overrides));
  }
  assert.equal(checks, 0);
});

test("socket: revocación de sesión y firma/algoritmo no autorizados", async () => {
  const token = sign(valid);
  await assert.rejects(authenticateSocketHandshake(handshake(token), secret, async () => false),
    /UNAUTHORIZED/);
  await assert.rejects(authenticateSocketHandshake(handshake(token), "another-secret", async () => true),
    /UNAUTHORIZED/);
  await assert.rejects(authenticateSocketHandshake(handshake(sign(valid, "HS384")), secret,
    async () => true), /UNAUTHORIZED/);
  await assert.rejects(authenticateSocketHandshake(handshake(token), "", async () => true),
    /UNAUTHORIZED/);
});

test("socket: rechaza JWT sin expiración aun con firma válida", async () => {
  const noExpiry = jwt.sign(valid, secret, { algorithm: "HS256" });
  let called = 0;
  await assert.rejects(authenticateSocketHandshake(handshake(noExpiry), secret, async () => {
    called++;
    return true;
  }), /UNAUTHORIZED/);
  assert.equal(called, 0);
});

test("socket: conserva compatibilidad explícita con tokenVersion legacy 0", async () => {
  const { tokenVersion, ...legacy } = valid;
  const auth = await authenticateSocketHandshake(handshake(sign(legacy)), secret,
    async () => true);
  assert.equal(auth.tokenVersion, 0);
});

test("socket: app.js usa el guard compartido antes de admitir la conexión", () => {
  const app = fs.readFileSync(path.join(__dirname, "../../app.js"), "utf8");
  assert.match(app, /socket\.auth = await authenticateSocketHandshake\(socket\.handshake, process\.env\.JWT_SECRET\)/);
  assert.doesNotMatch(app, /jwt\.verify\(token, process\.env\.JWT_SECRET/);
  assert.match(app, /joinTenantRealtimeRooms\(socket\)/);
  assert.match(app, /guardRealtimeSession\\(socket\\)/);
  assert.doesNotMatch(app, /socket\.join\(`empresa-/);
});
