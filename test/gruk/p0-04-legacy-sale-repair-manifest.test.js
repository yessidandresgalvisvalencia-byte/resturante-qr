'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validate } = require('../../scripts/gruk/p0-04-legacy-sale-repair-manifest');

const id = i => i.toString(16).padStart(24, '0');
function manifest() {
  return {
    database: 'restaurante',
    confirmDatabase: 'restaurante',
    sourceAuditRun: '44767149984',
    expectedAffectedSales: 16,
    backupEvidence: {
      realEncryptedCopyVerified: true,
      isolatedRestoreVerified: true,
      privateEvidenceReference: 'private-audit-reference'
    },
    independentDbaApproval: true,
    mappings: Array.from({length:16}, (_,i)=>({
      saleId:id(i+1),
      empresaId:id(501),
      sedeId:id(701),
      historicalSourceVerified:true,
      privateProvenanceReference:'verified-private-source'
    }))
  };
}
test('accepted manifest only prepares human review, never execution', () => {
  assert.deepEqual(validate(manifest()), { ready: true, errors: [] });
});
test('blocks missing independent restore evidence', () => {
  const x=manifest();
  x.backupEvidence.isolatedRestoreVerified=false;
  assert.equal(validate(x).ready,false);
});
test('blocks unsigned or unverified historical sale provenance', () => {
  const x=manifest();
  x.mappings[0].historicalSourceVerified=false;
  assert.equal(validate(x).ready,false);
});
test('blocks cross-database and inconsistent count', () => {
  const x=manifest();
  x.database='gruk_finanzas_personales';
  x.mappings.pop();
  assert.equal(validate(x).ready,false);
  assert.ok(validate(x).errors.some(e=>e.includes('restaurante')));
});
test('blocks duplicate sale and non-ObjectId identifiers', () => {
  const x=manifest();
  x.mappings[0].saleId='bad';
  x.mappings[1].saleId=x.mappings[2].saleId;
  assert.equal(validate(x).ready,false);
  assert.ok(validate(x).errors.some(e=>e.includes('Duplicate sale')));
});
test('rejects a null manifest', () => {
  assert.equal(validate(null).ready,false);
});
