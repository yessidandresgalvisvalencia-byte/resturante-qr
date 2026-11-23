"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { validarEventoWompi } = require("../../core/security/wompiWebhook.service");

const secret = "test-secret";
function signed(data, properties = ["transaction.id"]) {
  const timestamp = 1700000000;
  const body = { data, timestamp, signature: { properties } };
  const value = properties.reduce((s, p) => s + p.split(".").reduce((v, k) => v[k], data), "");
  body.signature.checksum = crypto.createHash("sha256").update(value + timestamp + secret).digest("hex");
  return body;
}

test("Wompi accepts a valid checksum with own nested payload fields", () => {
  const body = signed({ transaction: { id: "tx-123" } });
  assert.equal(validarEventoWompi(body, "", secret), true);
  assert.equal(validarEventoWompi(body, "0".repeat(64), secret), false);
});

test("Wompi refuses inherited payload properties even if checksum matches", () => {
  const data = Object.create({ transaction: { id: "inherited" } });
  const body = signed(data);
  assert.equal(validarEventoWompi(body, "", secret), false);
});

test("Wompi rejects prototype paths, object values, and malformed digests", () => {
  const body = signed({ transaction: { id: "tx-123" } });
  for (const path of ["__proto__", "constructor", "transaction.__proto__", "transaction.constructor", "transaction..id"]) {
    assert.equal(validarEventoWompi({ ...body, signature: { ...body.signature, properties: [path] } }, "", secret), false);
  }
  assert.equal(validarEventoWompi({ ...body, data: { transaction: { id: {} } } }, "", secret), false);
  assert.equal(validarEventoWompi(body, "g".repeat(64), secret), false);
});

test("Wompi rejects nonfinite signed values and malformed timestamp or checksum types", () => {
  const body = signed({ transaction: { id: "tx-123" } });
  for (const value of [NaN, Infinity, -Infinity]) {
    assert.equal(validarEventoWompi({ ...body, data: { transaction: { id: value } } }, "", secret), false);
    assert.equal(validarEventoWompi({ ...body, timestamp: value }, "", secret), false);
  }
  assert.equal(validarEventoWompi({ ...body, timestamp: {} }, "", secret), false);
  assert.equal(validarEventoWompi({ ...body, signature: { ...body.signature, checksum: {} } }, "", secret), false);
  assert.equal(validarEventoWompi(body, { toString: () => body.signature.checksum }, secret), false);
  assert.equal(validarEventoWompi({ ...body, signature: { ...body.signature, properties: Array(33).fill("transaction.id") } }, "", secret), false);
});
