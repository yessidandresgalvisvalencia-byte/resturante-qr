"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("GRUK CI checkout does not persist the Actions token", () => {
  const workflow = fs.readFileSync(path.join(__dirname, "../../.github/workflows/gruk-ci.yml"), "utf8");
  const checkout = workflow.match(/^      - name: Checkout\r?\n([\s\S]*?)(?=^      - name: |\s*$)/m);
  assert.ok(checkout, "checkout step must exist");
  assert.match(checkout[1], /^        uses: actions\/checkout@v4\s*$/m);
  assert.match(checkout[1], /^          persist-credentials: false\s*$/m);
  assert.doesNotMatch(checkout[1], /^          persist-credentials: true\s*$/m);
});
