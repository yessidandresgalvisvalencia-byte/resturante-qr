'use strict';
/**
 * P0-01: fail closed when an enterprise-only change set also edits another product.
 * Git paths come from git diff --name-only -z (never shell-interpolated).
 */
const { execFileSync } = require('node:child_process');
const { resolve } = require('node:path');
const { TextDecoder } = require('node:util');
const PROTECTED = [
  /(^|\/)(finanzas-personales|gruk-personal|blushea)(\/|\.|$)/i,
  /(^|\/)public\/finanzas-personales(?:\.|\/|$)/i,
];
function inspectChangedPaths(paths) {
  if (!Array.isArray(paths) || paths.some(p => typeof p !== 'string' || !p || p.includes('\0'))) {
    throw new TypeError('Invalid changed paths');
  }
  // Git paths must be relative and canonical; ambiguous spellings fail closed.
  for (const path of paths) {
    if (path.startsWith('/') || path.includes('\\\\') || path.split('/').some(part => !part || part === '.' || part === '..')) {
      throw new TypeError('Noncanonical changed path');
    }
  }
  const foreign = paths.filter(p => PROTECTED.some(pattern => pattern.test(p)));
  return { ok: foreign.length === 0, foreign };
}
// Disable rename detection so both the removed source and added destination are checked.
// Otherwise a rename out of a protected directory can hide the original path.
const DIFF_ARGS = Object.freeze(['diff', '--no-renames', '--name-only', '-z', '--diff-filter=ACMDTUXB']);
function parseGitDiffPaths(output) {
  if (!Buffer.isBuffer(output)) throw new TypeError('Expected git diff Buffer');
  // Invalid UTF-8 must fail closed: replacement characters can conceal protected paths.
  const decoded = new TextDecoder('utf-8', { fatal: true }).decode(output);
  if (decoded && !decoded.endsWith('\0')) throw new Error('Malformed NUL-delimited git diff');
  const paths = decoded ? decoded.slice(0, -1).split('\0') : [];
  if (paths.some(path => !path)) throw new Error('Empty path in git diff');
  return paths;
}
function main() {
  const base = process.env.GRUK_ISOLATION_BASE;
  if (!base || !/^[0-9a-f]{40}$/.test(base)) throw new Error('GRUK_ISOLATION_BASE must be a full commit SHA');
  const output = execFileSync('git', [...DIFF_ARGS, base, 'HEAD'], { cwd: resolve(__dirname, '../..') });
  const paths = parseGitDiffPaths(output);
  const result = inspectChangedPaths(paths);
  if (!result.ok) {
    console.error('P0-01 enterprise isolation violation:', result.foreign.join(', '));
    process.exitCode = 1;
  } else console.log('P0-01 enterprise isolation: no protected personal/Blushea paths changed');
}
if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { inspectChangedPaths, parseGitDiffPaths, DIFF_ARGS };
