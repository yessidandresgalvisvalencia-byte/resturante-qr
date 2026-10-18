"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const workflows = [
  ".github/workflows/ci.yml",
  ".github/workflows/gruk-ci.yml"
];

for (const archivo of workflows) {
  test(`${archivo}: el gate exige MongoDB local y confirmacion explicita`, () => {
    const yaml = fs.readFileSync(path.join(root, archivo), "utf8");
    assert.match(yaml, /^\s*TEST_MONGO_URI:\s*mongodb:\/\/127\.0\.0\.1:27017\/\?replicaSet=rs0&directConnection=true\s*$/m);
    assert.match(yaml, /^\s*GRUK_TEST_DB_CONFIRM:\s*SOLO_PRUEBAS_LOCALES\s*$/m);
    assert.match(yaml, /run:\s*npm run gate|npm run gate 2>&1/);
    assert.doesNotMatch(yaml, /^\s*TEST_MONGO_URI:.*mongodb\+srv:/m);
  });
}

test("GRUK CI corre tambien en push a la rama personal, incluso con PR bloqueada", () => {
 const yaml = fs.readFileSync(path.join(root, ".github/workflows/gruk-ci.yml"), "utf8");
 const push = yaml.match(/^  push:\s*\n([\s\S]*?)(?=^\S|^  [a-zA-Z_-]+:)/m);
 assert.ok(push, "Falta disparador push");
 assert.match(push[1], /^\s*- feature\/finanzas-personales\s*$/m);
});
