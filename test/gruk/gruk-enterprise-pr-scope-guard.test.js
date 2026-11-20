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

test("detects protected source path when a file is renamed into enterprise scope", () => {
  const fs = require("node:fs");
  const os = require("node:os");
  const path = require("node:path");
  const { execFileSync } = require("node:child_process");
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "gruk-scope-"));
  const original = process.cwd();
  const git = (...args) => execFileSync("git", args, { cwd: directory, encoding: "utf8" }).trim();
  try {
    git("init");
    git("config", "user.name", "GRUK CI");
    git("config", "user.email", "ci@example.invalid");
    fs.mkdirSync(path.join(directory, "modules", "finanzas-personales"), { recursive: true });
    fs.mkdirSync(path.join(directory, "modules", "empresarial"), { recursive: true });
    fs.writeFileSync(path.join(directory, "modules", "finanzas-personales", "example.js"), "module.exports = 1;\n");
    git("add", ".");
    git("commit", "-m", "initial");
    const base = git("rev-parse", "HEAD");
    fs.renameSync(path.join(directory, "modules", "finanzas-personales", "example.js"), path.join(directory, "modules", "empresarial", "example.js"));
    git("add", "-A");
    git("commit", "-m", "rename");
    const head = git("rev-parse", "HEAD");
    process.chdir(directory);
    const paths = changedFiles(base, head);
    assert.ok(paths.includes("modules/finanzas-personales/example.js"));
    assert.equal(violations(paths)[0].reason, "GRUK Finanzas Personales");
  } finally {
    process.chdir(original);
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
