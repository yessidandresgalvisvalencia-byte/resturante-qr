'use strict';
/**
 * P0-01: fail closed when an enterprise-only change set also edits another product.
 * Git paths come from git diff --name-only -z (never shell-interpolated).
 */
const { execFileSync } = require('node:child_process');
const { resolve } = require('node:path');
const PROTECTED = [
  /(^|\/)(finanzas-personales|gruk-personal|blushea)(\/|\.|$)/i,
  /(^|\/)public\/finanzas-personales(?:\.|\/|$)/i,
];
function inspectChangedPaths(paths) {
  if (!Array.isArray(paths) || paths.some(p => typeof p !== 'string' || !p || p.includes('\0'))) {
    throw new TypeError('Invalid changed paths');
  }
  const foreign = paths.filter(p => PROTECTED.some(pattern => pattern.test(p.replaceAll('\\', '/'))));
  return { ok: foreign.length === 0, foreign };
}
// Disable rename detection so both the removed source and added destination are checked.
// Otherwise a rename out of a protected directory can hide the original path.
const DIFF_ARGS = Object.freeze(['diff', '--no-renames', '--name-only', '-z', '--diff-filter=ACMDTUXB']);
function main() {
  const base = process.env.GRUK_ISOLATION_BASE;
  if (!base || !/^[0-9a-f]{40}$/.test(base)) throw new Error('GRUK_ISOLATION_BASE must be a full commit SHA');
  const output = execFileSync('git', [...DIFF_ARGS, base, 'HEAD'], { cwd: resolve(__dirname, '../..') });
  const paths = output.toString('utf8').split('\0').filter(Boolean);
  const result = inspectChangedPaths(paths);
  if (!result.ok) {
    console.error('P0-01 enterprise isolation violation:', result.foreign.join(', '));
    process.exitCode = 1;
  } else console.log('P0-01 enterprise isolation: no protected personal/Blushea paths changed');
}
if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { inspectChangedPaths, DIFF_ARGS };
