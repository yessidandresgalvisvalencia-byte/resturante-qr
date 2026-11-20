'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const code = fs.readFileSync(path.join(__dirname, '../../scripts/gruk/p0-04-legacy-sale-sites-readonly.js'), 'utf8');
function execute({ database = 'restaurante', confirm = database, saleCount = 16, aggregate = [{missing: 16, nullValues: 0, otherTypes: 0, noCandidate: 16, oneCandidate: 0, multipleCandidates: 0, affectedSales: 16}] } = {}) {
  const printed = [];
  const calls = [];
  const ctx = {
    process: { env: {GRUK_ENTERPRISE_DB:database, GRUK_ENTERPRISE_DB_CONFIRM:confirm} },
    db: {getSiblingDB(name) { calls.push('getSiblingDB'); assert.equal(name, 'restaurante'); return {getCollection(name) {
      assert.equal(name, 'ventas');
      return {estimatedDocumentCount(){return saleCount;}, aggregate(pipeline,opts) {
        assert.equal(pipeline[0].$match.sedeId.$not.$type, 'objectId');
        assert.equal(pipeline[1].$lookup.from, 'sedes');
        assert.equal(opts.maxTimeMS, 15000);
        calls.push('aggregate');
        return {toArray(){return aggregate;}};
      }};
    }}; }},
    printjson(data){printed.push(JSON.parse(JSON.stringify(data)));}
  };
  return {run(){vm.runInNewContext(code,ctx,{timeout:1000});},printed,calls};
}
test('aggregates 16 legacy sales without exposing documents or writing', ()=>{
  const ctx=execute();
  ctx.run();
  assert.equal(ctx.printed[0].affectedSales,16);
  assert.equal(ctx.printed[0].safeToMigrate,false);
  assert.equal(ctx.printed[0].requiresManualReview,true);
  assert.deepEqual(ctx.calls,['getSiblingDB','aggregate']);
});
test('rejects an unconfirmed or wrong production database before any access',()=>{
  for(const args of [{database:'gruk_finanzas_personales'},{confirm:'other'}]){
    const ctx=execute(args);
    assert.throws(ctx.run,/confirmation required/);
    assert.deepEqual(ctx.calls,[]);
  }
});
test('rejects contradictory counts rather than falsely declaring safety',()=>{
  const ctx=execute({aggregate:[{missing:15,nullValues:0,otherTypes:0,noCandidate:16,oneCandidate:0,multipleCandidates:0,affectedSales:16}]});
  assert.throws(ctx.run,/Inconsistent diagnostic aggregates/);
});
test('fails closed when collection is empty',()=>{
  const ctx=execute({saleCount:0});
  assert.throws(ctx.run,/empty or unreadable/);
  assert.equal(ctx.printed[0].safeToMigrate,false);
  assert.deepEqual(ctx.calls,['getSiblingDB']);
});
