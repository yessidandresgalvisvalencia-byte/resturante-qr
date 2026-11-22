'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { inspectChangedPaths } = require('../../scripts/gruk/p001-enterprise-path-isolation');
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
