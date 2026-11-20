"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const matrixPath = path.resolve(__dirname, "../../docs/gruk-enterprise-master-traceability.md");

test("Plan Maestro traceability has exactly 77 unique ordered requirements with acceptance and evidence columns", () => {
  const content = fs.readFileSync(matrixPath, "utf8");
  const rows = content.split(/\r?\n/).filter(line => /^\|\s*\d{2}\s*\|/.test(line));
  assert.equal(rows.length, 77, "must have 77 requirement rows");
  const ids = [];
  for (const row of rows) {
    const cells = row.split("|").slice(1, -1).map(cell => cell.trim());
    assert.equal(cells.length, 7, "seven traceability columns required");
    const [id, requirement, priority, acceptance, code, evidence, status] = cells;
    ids.push(id);
    assert.match(priority, /^P[0-3]$/, `invalid priority for ${id}`);
    for (const [name, value] of Object.entries({ requirement, acceptance, code, evidence, status })) {
      assert.ok(value.length > 0, `missing ${name} for ${id}`);
    }
    assert.match(status, /no certificado/i, `requirement ${id} must not be silently certified`);
  }
  assert.deepEqual(ids, Array.from({ length: 77 }, (_, i) => String(i + 1).padStart(2, "0")));
});
