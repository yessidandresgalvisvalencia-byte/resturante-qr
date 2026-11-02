#!/usr/bin/env node
"use strict";
/* Static plan integrity only. This script NEVER certifies deployment readiness. */
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const STATES = new Set(["SIN_AUDITAR", "PARCIAL", "BLOQUEADO", "VERIFICADO"]);
const PRIORITIES = new Set(["P0", "P1", "P2", "P3"]);
function rows(markdown, width, name) {
  if (typeof markdown !== "string") throw Error(name + ": invalid Markdown");
  return markdown.split(/\r?\n/).filter(line => /^\|\s*\d{2}\s*\|/.test(line)).map(line => {
    const cells = line.split("|").slice(1, -1).map(x => x.trim());
    if (cells.length !== width) throw Error(name + ": invalid row columns");
    return cells;
  });
}
function validate(criteriaMarkdown, matrixMarkdown) {
  const criteria = rows(criteriaMarkdown, 5, "criteria");
  const matrix = rows(matrixMarkdown, 5, "matrix");
  if (criteria.length !== 77 || matrix.length !== 77)
    throw Error("GRUK_PLAN_77_ROWS_REQUIRED");
  const counts = { SIN_AUDITAR: 0, PARCIAL: 0, BLOQUEADO: 0, VERIFICADO: 0 };
  for (let i = 0; i < 77; i++) {
    const expected = String(i + 1).padStart(2, "0");
    const [id, priority, title, action, criterion] = criteria[i];
    const [mid, mpriority, mtitle, status, evidence] = matrix[i];
    if (id !== expected || mid !== expected) throw Error("GRUK_PLAN_ID_ORDER_" + expected);
    if (!PRIORITIES.has(priority) || priority !== mpriority)
      throw Error("GRUK_PLAN_PRIORITY_MISMATCH_" + id);
    if (title !== mtitle || !title || !action || !criterion ||
        action.length < 12 || criterion.length < 12)
      throw Error("GRUK_PLAN_CRITERION_MISMATCH_" + id);
    if (!STATES.has(status)) throw Error("GRUK_PLAN_INVALID_STATE_" + id);
    if (status === "VERIFICADO" && !(
      /github\.com\/[^)\s]+\/(pull|commit)\/\d+|github\.com\/[^)\s]+\/commit\/[a-f0-9]{7,40}/.test(evidence) &&
      /test\/[^)\s]+\.test\.[cm]?js/.test(evidence) &&
      /criterio|aceptaci[oó]n/i.test(evidence)
    )) throw Error("GRUK_PLAN_UNSUPPORTED_VERIFIED_" + id);
    counts[status]++;
  }
  return { total: 77, counts, allVerified: counts.VERIFICADO === 77,
    releaseAuthorized: false };
}
// Evidence is a claim, not proof. Reject references to non-existent tests or
// unrelated repositories before any row can be reported as verified.
function validateEvidencePaths(matrixMarkdown, root) {
  const matrix = rows(matrixMarkdown, 5, "matrix");
  for (const [id, , , status, evidence] of matrix) {
    if (status !== "VERIFICADO") continue;
    const links = [...evidence.matchAll(/https:\/\/github\.com\/([^/\s)]+)\/([^/\s)]+)\/(pull|commit)\/([^/\s)\]]+)/gi)];
    // A valid link must not mask a second untrusted or malformed GitHub URL.
    const githubUrls = [...evidence.matchAll(/https?:\/\/github\.com\/[^\s)\]>`]+/gi)].map(m => m[0]);
    if (!githubUrls.length || githubUrls.length !== links.length ||
        githubUrls.some(url => !/^https:\/\/github\.com\/yessidandresgalvisvalencia-byte\/resturante-qr\/(?:pull\/\d+|commit\/[a-f0-9]{7,40})$/i.test(url)))
      throw Error("GRUK_PLAN_UNTRUSTED_EVIDENCE_URL_" + id);
    if (!links.length || links.some(m => m[1] !== "yessidandresgalvisvalencia-byte" ||
        m[2] !== "resturante-qr" || (m[3] === "pull" && !/^\d+$/.test(m[4])) ||
        (m[3] === "commit" && !/^[a-f0-9]{7,40}$/i.test(m[4]))))
      throw Error("GRUK_PLAN_UNTRUSTED_EVIDENCE_URL_" + id);
    // Inspect complete test-path tokens: a valid prefix must not hide an
    // invalid suffix or a second malformed evidence path.
    const testTokens = [...evidence.matchAll(/(?:^|[\s(])((?:test\/)[^\s)\]>`]+)/g)].map(m => m[1]);
    const tests = testTokens.filter(token =>
      /^test\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.test\.[cm]?js$/.test(token));
    if (testTokens.length === 0 || tests.length !== testTokens.length)
      throw Error("GRUK_PLAN_MISSING_EVIDENCE_TEST_" + id);
    if (!tests.length || tests.some(testPath => {
      const full = path.resolve(root, testPath);
      const testRoot = path.resolve(root, "test");
      if (!full.startsWith(testRoot + path.sep) || !fs.existsSync(full)) return true;
      // A symlink inside test/ may point outside the checkout; reject it.
      // Only committed regular test files count as local evidence.
      if (!fs.lstatSync(full).isFile() ||
          !fs.realpathSync(full).startsWith(fs.realpathSync(testRoot) + path.sep)) return true;
      // An empty placeholder with a .test.js suffix is not executable evidence.
      // This only checks that a test is declared; passing CI is a separate gate.
      const source = fs.readFileSync(full, "utf8");
      if (!/(?:\btest|\bit|\bdescribe)\s*\(/.test(source)) return true;
      // Syntax validation does not execute the test or import its dependencies.
      const checked = spawnSync(process.execPath, ["--check", full], {
        encoding: "utf8", timeout: 10000, maxBuffer: 1024 * 1024
      });
      return checked.error != null || checked.status !== 0;
    })) throw Error("GRUK_PLAN_MISSING_EVIDENCE_TEST_" + id);
  }
  return true;
}
function main(args = process.argv.slice(2)) {
  const root = path.join(__dirname, "..");
  const criteria = fs.readFileSync(path.join(root, "docs/GRUK_PLAN_MAESTRO_77_CRITERIOS.md"), "utf8");
  const matrix = fs.readFileSync(path.join(root, "docs/GRUK_PLAN_MAESTRO_77_TRAZABILIDAD.md"), "utf8");
  const result = validate(criteria, matrix);
  validateEvidencePaths(matrix, root);
  process.stdout.write(JSON.stringify(result) + "\n");
  // Even a fully verified matrix is not a production authorization:
  // staging, financial reconciliation, security, backup/restore and Render
  // must be checked independently against the live environment.
  if (args.includes("--require-complete") && !result.allVerified)
    throw Error("GRUK_RELEASE_BLOCKED_77_ACCEPTANCE_NOT_VERIFIED");
  return result;
}
if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { validate, validateEvidencePaths, main };
