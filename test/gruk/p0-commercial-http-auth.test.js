"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const authMiddleware = require("../../core/auth/auth.middleware");

const SECRET = "gruk-http-regression-not-a-production-secret";
const base = Object.freeze({
  sub: "user-commercial-1",
  empresaId: "aaaaaaaaaaaaaaaaaaaaaaaa",
  sedeId: "111111111111111111111111",
  rol: "ADMIN_SEDE",
  tokenVersion: 0
});

function invoke(token, headers = {}) {
  const req = { headers: token === null ? headers : { ...headers, authorization: token } };
  let response = null;
  let nextCalls = 0;
  const res = {
    status(statusCode) {
      response = { statusCode };
      return this;
    },
    json(data) {
      response = { ...response, data };
      return this;
    }
  };
  return Promise.resolve(authMiddleware(req, res, () => { nextCalls++; }))
    .then(() => ({ req, response, nextCalls }));
}

test("P0 commercial HTTP: signed identity controls scope, not client-supplied context", async () => {
  process.env.JWT_SECRET = SECRET;
  const token = jwt.sign(base, SECRET, { algorithm: "HS256", expiresIn: "5m" });
  const result = await invoke("Bearer " + token);
  assert.equal(result.response, null);
  assert.equal(result.nextCalls, 1);
  assert.equal(result.req.auth.empresaId, base.empresaId);
  assert.equal(result.req.auth.sedeId, base.sedeId);
  assert.equal(Object.isFrozen(result.req.auth), true);
});

test("P0 commercial HTTP: rejects invalid tenant/site roles and token versions before authorization", async () => {
  process.env.JWT_SECRET = SECRET;
  for (const claims of [
    { ...base, empresaId: "tenant.$where" },
    { ...base, sedeId: "branch.$ne" },
    { ...base, rol: "SUPER_ADMIN" },
    { ...base, tokenVersion: -1 },
    { ...base, empresaId: undefined },
    { ...base, sub: "" },
    { ...base, sedeId: " " }
  ]) {
    const token = jwt.sign(claims, SECRET, { algorithm: "HS256" });
    const result = await invoke("Bearer " + token);
    assert.equal(result.response?.statusCode, 401, JSON.stringify(claims));
    assert.equal(result.nextCalls, 0);
    assert.equal(result.req.auth, undefined);
  }
});

test("P0 commercial HTTP: rejects invalid token, expired JWT and wrong algorithm", async () => {
  process.env.JWT_SECRET = SECRET;
  const invalid = [
    "Bearer fake.token.value",
    "Bearer " + jwt.sign(base, SECRET, { algorithm: "HS384" }),
    "Bearer " + jwt.sign(base, SECRET, { algorithm: "HS256", expiresIn: -1 }),
    "Bearer ",
    ""
  ];
  for (const header of invalid) {
    const result = await invoke(header);
    assert.equal(result.response?.statusCode, 401);
    assert.equal(result.nextCalls, 0);
    assert.equal(result.req.auth, undefined);
  }
  const missing = await invoke(null);
  assert.equal(missing.response?.statusCode, 401);
  assert.equal(missing.nextCalls, 0);
});

test("P0 commercial HTTP: invalid signing configuration denies access", async () => {
  const prev = process.env.JWT_SECRET;
  delete process.env.JWT_SECRET;
  try {
    const result = await invoke("Bearer any.jwt.value");
    assert.equal(result.response?.statusCode, 500);
    assert.equal(result.nextCalls, 0);
    assert.equal(result.req.auth, undefined);
  } finally {
    if (prev === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = prev;
  }
});
