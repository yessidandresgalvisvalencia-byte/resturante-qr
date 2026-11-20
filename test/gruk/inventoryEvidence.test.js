"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { inventory, AREAS } = require("../../scripts/gruk-inventory-evidence");
test("P0-02 inventory never marks an untested module complete", () => {
 const root = fs.mkdtempSync(path.join(os.tmpdir(), "gruk-inventory-"));
 try {
  const first = inventory(root);
  assert.equal(first.length, 8);
  assert.ok(first.every(item => item.status === "sin_evidencia"));
  fs.mkdirSync(path.join(root, "routes"));
  fs.writeFileSync(path.join(root, "routes/API.js"), "");
  const second = inventory(root);
  assert.equal(second.find(item => item.area === "pedidos").status, "sin_verificar");
  assert.equal(second.find(item => item.area === "cocina").status, "sin_verificar");
  assert.ok(second.every(item => item.status !== "terminado"));
  assert.deepEqual(Object.keys(AREAS).sort(), second.map(x => x.area).sort());
 } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
