'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { inspectChangedPaths, parseGitDiffPaths, DIFF_ARGS } = require('../../scripts/gruk/p001-enterprise-path-isolation');
test('enterprise changes are allowed', () => {
  assert.deepEqual(inspectChangedPaths(['core/finanzas/ledger.js','test/gruk/ledger.test.js']), {ok:true,foreign:[]});
});
test('personal and Blushea changes are rejected', () => {
  const paths=['public/finanzas-personales.js','blushea/app.js','core/gruk-personal/ledger.js','core/empresa.js'];
  assert.deepEqual(inspectChangedPaths(paths), {ok:false,foreign:paths.slice(0,3)});
});
test('similar names do not cause false positives', () => {
  assert.equal(inspectChangedPaths(['docs/blushea-independent-policy.md','core/finanzas-personales-empresarial.js']).ok,true);
});
test('malformed input is rejected', () => {
  assert.throws(()=>inspectChangedPaths(['ok.js',null]),TypeError);
  assert.throws(()=>inspectChangedPaths(['bad\0name']),TypeError);
});

test('git diff disables rename detection and checks deleted protected source paths', () => {
  assert.ok(DIFF_ARGS.includes('--no-renames'));
  assert.ok(DIFF_ARGS.includes('--name-only'));
  assert.ok(DIFF_ARGS.includes('-z'));
  assert.ok(DIFF_ARGS.some(arg => arg.startsWith('--diff-filter=') && arg.includes('D') && arg.includes('T')));
  assert.equal(inspectChangedPaths(['public/finanzas-personales.js', 'core/enterprise.js']).ok, false);
});

test('strict git diff decoder rejects invalid UTF-8 and malformed delimiters', () => {
  assert.deepEqual(parseGitDiffPaths(Buffer.alloc(0)), []);
  assert.deepEqual(parseGitDiffPaths(Buffer.from('core/empresa.js\0public/finanzas-personales.js\0')), ['core/empresa.js', 'public/finanzas-personales.js']);
  assert.throws(() => parseGitDiffPaths(Buffer.from([0xff, 0x00])), TypeError);
  assert.throws(() => parseGitDiffPaths(Buffer.from('public/finanzas-personales.js')), /Malformed/);
  assert.throws(() => parseGitDiffPaths(Buffer.from('core/a.js\0\0')), /Empty path/);
  assert.throws(() => parseGitDiffPaths('core/a.js\0'), TypeError);
});

test('noncanonical paths fail closed instead of being normalized', () => {
  for (const path of ['/public/finanzas-personales.js', 'core/../public/finanzas-personales.js', './core/empresa.js', 'core//empresa.js', 'core\\\\blushea\\\\app.js']) {
    assert.throws(() => inspectChangedPaths([path]), /Noncanonical/);
  }
});

test('real git rename from protected product is detected even when git recognizes a rename', (t) => {
  const { mkdtempSync, mkdirSync, writeFileSync, renameSync, rmSync } = require('node:fs');
  const { tmpdir } = require('node:os');
  const { join, dirname } = require('node:path');
  const { execFileSync } = require('node:child_process');
  const dir = mkdtempSync(join(tmpdir(), 'gruk-p001-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: dir });
  git('init', '-q');
  git('config', 'user.email', 'ci@example.invalid');
  git('config', 'user.name', 'GRUK CI');
  const oldPath = join(dir, 'public/finanzas-personales.js');
  const newPath = join(dir, 'core/enterprise.js');
  mkdirSync(dirname(oldPath), { recursive: true });
  writeFileSync(oldPath, 'module.exports = 1;\n');
  git('add', '.');
  git('commit', '-qm', 'baseline');
  const base = git('rev-parse', 'HEAD').toString().trim();
  mkdirSync(dirname(newPath), { recursive: true });
  renameSync(oldPath, newPath);
  git('add', '-A');
  git('commit', '-qm', 'rename');
  const raw = git(...DIFF_ARGS, base, 'HEAD');
  const paths = parseGitDiffPaths(raw);
  assert.ok(paths.includes('public/finanzas-personales.js'), 'deleted protected source must be visible');
  assert.ok(paths.includes('core/enterprise.js'), 'new enterprise destination must be visible');
  assert.equal(inspectChangedPaths(paths).ok, false);
});
