"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { validarEventoWompi } = require("../../core/security/wompiWebhook.service");

const secret = "fixture-secret";
function fixture(properties) {
  const data = { transaction: { id: "tx-1", status: "APPROVED" } };
  const timestamp = 1700000000;
  const values = properties.map(path => path.split(".").reduce((value, key) => value[key], data)).join("");
  const checksum = crypto.createHash("sha256").update(values + timestamp + secret).digest("hex");
  return { data, timestamp, signature: { properties, checksum } };
}

test("Wompi accepts distinct signed fields with matching checksum", () => {
  assert.equal(validarEventoWompi(fixture(["transaction.id", "transaction.status"]), "", secret), true);
});

test("Wompi rejects duplicate signed paths even with a matching checksum", () => {
  const body = fixture(["transaction.id", "transaction.id"]);
  assert.equal(validarEventoWompi(body, "", secret), false);
  assert.equal(validarEventoWompi(body, body.signature.checksum, secret), false);
});

test("Wompi rejects duplicate nested paths without rejecting distinct paths", () => {
  assert.equal(validarEventoWompi(fixture(["transaction.status", "transaction.status"]), "", secret), false);
  assert.equal(validarEventoWompi(fixture(["transaction.status", "transaction.id"]), "", secret), true);
});
