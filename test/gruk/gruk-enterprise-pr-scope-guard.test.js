"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { forbiddenReason, violations, changedFiles } = require("../../scripts/gruk-enterprise-pr-scope-guard");

test("blocks finance personal and Blushea paths without blocking enterprise code", () => {
  const files = [
    "modules/finanzas-personales/ledger.js",
    "public/finanzas-personales.js",
    "public/finanzas-personales.html",
    "public/finanzas-personales/index.html",
    "apps/blushea/src/app.js",
    "Blushéa/package.json",
    "routes/pagos.js",
    "test/gruk/tenant-isolation.test.js"
  ];
  assert.deepEqual(violations(files).map(x => x.file), files.slice(0, 6));
});
test("normalizes windows separators and case", () => {
  assert.equal(forbiddenReason("MODULES\\FINANZAS-PERSONALES\\data.js"), "GRUK Finanzas Personales");
  assert.equal(forbiddenReason("apps\\BLUSHEA\\app.js"), "Blushéa");
  assert.equal(forbiddenReason("modules/finanzas-empresariales/ledger.js"), null);
});
test("rejects missing or invalid refs before running git", () => {
  assert.throws(() => changedFiles("main", "HEAD"), /full 40-character/);
  assert.throws(() => changedFiles("a".repeat(40), ""), /full 40-character/);
});
