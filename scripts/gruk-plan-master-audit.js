#!/usr/bin/env node
"use strict";
/* Static plan integrity only. This script NEVER certifies deployment readiness. */
const fs = require("node:fs");
const path = require("node:path");
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
function main(args = process.argv.slice(2)) {
  const root = path.join(__dirname, "..");
  const criteria = fs.readFileSync(path.join(root, "docs/GRUK_PLAN_MAESTRO_77_CRITERIOS.md"), "utf8");
  const matrix = fs.readFileSync(path.join(root, "docs/GRUK_PLAN_MAESTRO_77_TRAZABILIDAD.md"), "utf8");
  const result = validate(criteria, matrix);
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
module.exports = { validate, main };
