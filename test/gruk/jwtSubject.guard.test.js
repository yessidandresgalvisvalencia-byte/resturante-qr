"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { claimsValidas } = require("../../core/auth/jwtClaims.guard");
const valid = { sub: "507f1f77bcf86cd799439011", empresaId: "507f191e810c19729de860ea", rol: "EMPLEADO", tokenVersion: 0 };
test("valid identity and tenant claims remain accepted", () => {
  assert.equal(claimsValidas(valid), true);
  assert.equal(claimsValidas({...valid, sub: "550e8400-e29b-41d4-a716-446655440000"}), true);
});
test("reject malformed subject IDs before they reach database filters", () => {
  for (const sub of ["", " ", " abc", "abc ", "$ne", "a.b", "a/b", "a\\nb", "x".repeat(81), {}, ["x"], 123]) {
    assert.equal(claimsValidas({...valid, sub}), false, "unexpected acceptance: " + JSON.stringify(sub));
  }
});
test("reject malformed company and location scope IDs", () => {
  for (const field of ["empresaId", "sedeId", "restaurantId"]) {
    for (const value of ["$ne", "tenant other", "x.y", "x".repeat(81)]) {
      assert.equal(claimsValidas({...valid, [field]: value}), false);
    }
  }
});
