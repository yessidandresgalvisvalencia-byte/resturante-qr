'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname,'../../scripts/gruk/p0-04-legacy-sales-atomic-fix.js'),'utf8');
test('script syntax parses without running against a real database',()=>{
  assert.doesNotThrow(()=>new vm.Script(source));
});
test('migration is strictly scoped to enterprise database and explicit confirmation',()=>{
  assert.match(source,/GRUK_ENTERPRISE_DB !== 'restaurante'/);
  assert.match(source,/GRUK_ENTERPRISE_DB_CONFIRM !== 'restaurante'/);
  assert.match(source,/GRUK_P004_APPROVAL !== 'CORREGIR_16_VENTAS'/);
});
test('requires exactly 16 legacy rows and no alternate invalid site types',()=>{
  assert.match(source,/legacy.length !== 16 \|\| invalid !== 16/);
  assert.match(source,/sale\.sedeId !== null/);
  assert.match(source,/chosen\.createdAt\.getTime\(\) > order\.createdAt\.getTime\(\)/);
});
test('only updates site identifier and preserves original full sale document',()=>{
  const patches=[...source.matchAll(/sales\.updateOne\([\s\S]*?\},\{\$set:\{([\s\S]*?)\}\}\)/g)];
  assert.equal(patches.length,1);
  assert.match(patches[0][1],/^sedeId:item\.siteId$/);
  assert.match(source,/original:before,sourceHash/);
  assert.match(source,/serialization\(actual\) !== serialization\(expected\)/);
  assert.match(source,/session\.withTransaction/);
});
test('no unconstrained updates and no deletions',()=>{
  assert.doesNotMatch(source,/\b(deleteOne|deleteMany|drop|updateMany|replaceOne)\s*\(/);
  assert.match(source,/result\.matchedCount !== 1 \|\| result\.modifiedCount !== 1/);
});
