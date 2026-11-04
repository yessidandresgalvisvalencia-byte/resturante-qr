"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { validarEventoWompi } = require("../../core/security/wompiWebhook.service");

const SECRET = "enterprise-test-integrity-secret";
function eventFixture() {
  return {
    timestamp: 1700000000,
    data: { transaction: { id: "tx-100", status: "APPROVED", amount_in_cents: 123456 } },
    signature: { properties: ["transaction.id", "transaction.status", "transaction.amount_in_cents"] },
  };
}
function sign(body, secret = SECRET) {
  const values = body.signature.properties.map(path =>
    path.split(".").reduce((value, part) => value[part], body.data)
  ).join("");
  return crypto.createHash("sha256").update(values + body.timestamp + secret).digest("hex");
}

test("enterprise webhook: accepts a valid signed Wompi payload", () => {
  const body = eventFixture();
  const checksum = sign(body);
  assert.equal(validarEventoWompi(body, checksum, SECRET), true);
  assert.equal(validarEventoWompi(body, checksum.toUpperCase(), SECRET), true);
});

test("enterprise webhook: rejects tampering with payment amount, status, id or timestamp", () => {
  const body = eventFixture();
  const checksum = sign(body);
  for (const mutate of [
    e => { e.data.transaction.amount_in_cents += 1; },
    e => { e.data.transaction.status = "DECLINED"; },
    e => { e.data.transaction.id = "tx-other"; },
    e => { e.timestamp += 1; },
  ]) {
    const tampered = structuredClone(body);
    mutate(tampered);
    assert.equal(validarEventoWompi(tampered, checksum, SECRET), false);
  }
});

test("enterprise webhook: rejects missing secret, missing signed fields and malformed checksum", () => {
  const body = eventFixture();
  const checksum = sign(body);
  assert.equal(validarEventoWompi(body, checksum, ""), false);
  assert.equal(validarEventoWompi(body, "", SECRET), false);
  assert.equal(validarEventoWompi(body, "abc", SECRET), false);
  const missingField = structuredClone(body);
  delete missingField.data.transaction.status;
  assert.equal(validarEventoWompi(missingField, checksum, SECRET), false);
  const missingProperties = structuredClone(body);
  missingProperties.signature.properties = [];
  assert.equal(validarEventoWompi(missingProperties, checksum, SECRET), false);
});
