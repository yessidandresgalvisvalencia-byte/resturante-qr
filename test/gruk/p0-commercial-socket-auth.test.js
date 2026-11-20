"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const { createSocketAuthMiddleware } = require("../../core/auth/socketAuth.middleware");

const SECRET = "gruk-socket-test-only-not-a-production-secret";
const baseClaims = Object.freeze({
  sub: "user-1",
  empresaId: "aaaaaaaaaaaaaaaaaaaaaaaa",
  sedeId: "111111111111111111111111",
  rol: "ADMIN_SEDE",
  tokenVersion: 0
});

async function handshake(token, validateSession = async () => true) {
  const socket = { handshake: { auth: { token } } };
  let calls = 0;
  let error;
  await createSocketAuthMiddleware({ validateSession })(socket, (value) => {
    calls++;
    error = value;
  });
  assert.equal(calls, 1, "Socket handshake must terminate exactly once");
  return { socket, error };
}

test("commercial socket: accepts valid tenant/site claims and freezes scope", async () => {
  process.env.JWT_SECRET = SECRET;
  const token = jwt.sign(baseClaims, SECRET, { algorithm: "HS256", expiresIn: "5m" });
  const { socket, error } = await handshake("Bearer " + token);
  assert.equal(error, undefined);
  assert.equal(socket.auth.empresaId, baseClaims.empresaId);
  assert.equal(socket.auth.sedeId, baseClaims.sedeId);
  assert.equal(socket.auth.rol, baseClaims.rol);
  assert.equal(Object.isFrozen(socket.auth), true);
});

test("commercial socket: rejects forged or malformed tenant, role and version claims before session lookup", async () => {
  process.env.JWT_SECRET = SECRET;
  const unsafeClaims = [
    { ...baseClaims, empresaId: "tenant.$where" },
    { ...baseClaims, empresaId: " " },
    { ...baseClaims, sedeId: "branch:operator" },
    { ...baseClaims, rol: "SUPER_ADMIN" },
    { ...baseClaims, tokenVersion: -1 },
    { ...baseClaims, sub: "" },
    { ...baseClaims, empresaId: undefined }
  ];
  let sessionLookups = 0;
  for (const claims of unsafeClaims) {
    const token = jwt.sign(claims, SECRET, { algorithm: "HS256" });
    const { socket, error } = await handshake(token, async () => {
      sessionLookups++;
      return true;
    });
    assert.equal(error?.message, "UNAUTHORIZED", JSON.stringify(claims));
    assert.equal(socket.auth, undefined, "denied socket cannot acquire a tenant scope");
  }
  assert.equal(sessionLookups, 0, "invalid claims must not consult identity/session DB");
});

test("commercial socket: rejects expired JWTs, wrong algorithm and revoked sessions", async () => {
  process.env.JWT_SECRET = SECRET;
  const expired = jwt.sign(baseClaims, SECRET, { algorithm: "HS256", expiresIn: -1 });
  const unsupported = jwt.sign(baseClaims, SECRET, { algorithm: "HS384" });
  for (const token of [expired, unsupported, "not-a-jwt", null]) {
    const { socket, error } = await handshake(token);
    assert.equal(error?.message, "UNAUTHORIZED");
    assert.equal(socket.auth, undefined);
  }

  const token = jwt.sign(baseClaims, SECRET, { algorithm: "HS256" });
  const { socket, error } = await handshake(token, async () => false);
  assert.equal(error?.message, "UNAUTHORIZED");
  assert.equal(socket.auth, undefined);
});

test("commercial socket: denies missing signing secret without exposing tenant scope", async () => {
  const previous = process.env.JWT_SECRET;
  delete process.env.JWT_SECRET;
  try {
    const { socket, error } = await handshake("irrelevant");
    assert.equal(error?.message, "UNAUTHORIZED");
    assert.equal(socket.auth, undefined);
  } finally {
    if (previous === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previous;
  }
});
