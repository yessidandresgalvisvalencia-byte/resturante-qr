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
