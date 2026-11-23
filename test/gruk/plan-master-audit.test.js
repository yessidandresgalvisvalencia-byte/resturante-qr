"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { validate } = require("../../scripts/gruk-plan-master-audit");

function fixture() {
  const criteria = [];
  const matrix = [];
  for (let i = 1; i <= 77; i++) {
    const id = String(i).padStart(2, "0");
    criteria.push(`| ${id} | P0 | Requirement ${id} | Implement isolated enterprise requirement | Acceptance requires executed evidence |`);
    matrix.push(`| ${id} | P0 | Requirement ${id} | SIN_AUDITAR | Pending |`);
  }
  return { criteria, matrix };
}
test("77 unverified items never authorize production", () => {
  const { criteria, matrix } = fixture();
  const result = validate(criteria.join("\n"), matrix.join("\n"));
  assert.equal(result.total, 77);
  assert.equal(result.counts.SIN_AUDITAR, 77);
  assert.equal(result.allVerified, false);
  assert.equal(result.releaseAuthorized, false);
});
test("missing rows fail closed", () => {
  const { criteria, matrix } = fixture();
  assert.throws(() => validate(criteria.slice(1).join("\n"), matrix.join("\n")), /GRUK_PLAN_77_ROWS_REQUIRED/);
});
test("priority mismatch fails closed", () => {
  const { criteria, matrix } = fixture();
  matrix[0] = matrix[0].replace("| P0 |", "| P1 |");
  assert.throws(() => validate(criteria.join("\n"), matrix.join("\n")), /GRUK_PLAN_PRIORITY_MISMATCH_01/);
});
test("verified without code and test evidence is rejected", () => {
  const { criteria, matrix } = fixture();
  matrix[0] = matrix[0].replace("SIN_AUDITAR | Pending", "VERIFICADO | Pending");
  assert.throws(() => validate(criteria.join("\n"), matrix.join("\n")), /GRUK_PLAN_UNSUPPORTED_VERIFIED_01/);
});
