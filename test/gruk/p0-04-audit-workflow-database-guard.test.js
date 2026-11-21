"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const workflow = fs.readFileSync(path.join(__dirname,
  "../../.github/workflows/gruk-enterprise-money-readonly-audit.yml"), "utf8");
const guard = workflow.match(/^\s*if \[\[ ! "\$DB_NAME" =~ \^\[A-Za-z\].*\]\]; then$/m);
test("P0-04: audit workflow rejects case variants of reserved DB names before Mongo access", () => {
  assert.ok(guard, "Expected the database-name guard in workflow");
  for (const name of ["Blushea", "FINANZAS_personales", "GRUK_ADMIN", "Local", "TeSt", "gruk_empresarial"]) {
    const shell = `DB_NAME="${name}"; ${guard[0].trim()} echo rejected; else echo allowed; fi`;
    const result = spawnSync("bash", ["-c", shell], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), name === "gruk_empresarial" ? "allowed" : "rejected", name);
  }
});
