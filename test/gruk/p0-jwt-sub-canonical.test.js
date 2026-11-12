"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { claimsValidas } = require("../../core/auth/jwtClaims.guard");

const base = { sub: "user_01", empresaId: "empresa-01", rol: "EMPLEADO" };

test("P0-08: canonical JWT subjects remain valid for all enterprise roles", () => {
  for (const rol of ["DUEÑO", "ADMIN_SEDE", "EMPLEADO"]) {
    assert.equal(claimsValidas({ ...base, rol }), true);
  }
});

test("P0-08: reject operator-like and whitespace subject identifiers", () => {
  for (const sub of ["user 01", " user", "user\n", "$ne", "user.name", "user/01", "user:01", "á", "\u0000"]) {
    assert.equal(claimsValidas({ ...base, sub }), false, JSON.stringify(sub));
  }
});

test("P0-08: reject overlong JWT subject before database identity lookup", () => {
  assert.equal(claimsValidas({ ...base, sub: "a".repeat(80) }), true);
  assert.equal(claimsValidas({ ...base, sub: "a".repeat(81) }), false);
});

test("P0-08: invalid subject cannot be rescued by valid tenant or role", () => {
  for (const rol of ["DUEÑO", "ADMIN_SEDE", "EMPLEADO"]) {
    assert.equal(claimsValidas({ ...base, rol, sub: { $ne: null } }), false);
  }
});
