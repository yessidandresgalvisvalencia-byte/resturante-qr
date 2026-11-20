'use strict';

// P0-04 operational manifest validator. NO MongoDB connection and NO writes.
// A sole currently active site does not establish historic site provenance.
// Input manifest lives in an approved private location, NEVER in GitHub.
const fs = require('node:fs');

const OBJECT_ID = /^[a-fA-F0-9]{24}$/;
const EXPECTED_DATABASE = 'restaurante';
const RUN_NUMBER = '44767149984';

function validate(manifest) {
  const errors = [];
  const add = msg => errors.push(msg);
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return { ready: false, errors: ['Manifest must be an object'] };
  }
  if (manifest.database !== EXPECTED_DATABASE || manifest.confirmDatabase !== EXPECTED_DATABASE) {
    add('Database must be explicitly confirmed as restaurante');
  }
  if (String(manifest.sourceAuditRun || '') !== RUN_NUMBER) add('Source real-data audit must match verified run');
  if (manifest.expectedAffectedSales !== 16) add('Expected affected count must equal 16');
  // Evidence is mandatory but cannot be verified from an operator statement alone.
  const backup = manifest.backupEvidence;
  if (!backup || typeof backup !== 'object' ||
    backup.realEncryptedCopyVerified !== true ||
    backup.isolatedRestoreVerified !== true ||
    typeof backup.privateEvidenceReference !== 'string' ||
    backup.privateEvidenceReference.trim().length < 12) {
    add('Independent encrypted production backup and isolated restore evidence required');
  }
  if (manifest.independentDbaApproval !== true) add('Independent DBA approval required');
  const mappings = manifest.mappings;
  if (!Array.isArray(mappings) || mappings.length !== 16) {
    add('Exactly 16 explicit per-sale mappings required');
  }
  const seen = new Set();
  for (const entry of Array.isArray(mappings) ? mappings : []) {
    if (!entry || typeof entry !== 'object') { add('Malformed mapping'); continue; }
    for (const field of ['saleId','empresaId','sedeId']) {
      if (typeof entry[field] !== 'string' || !OBJECT_ID.test(entry[field])) {
        add('Invalid sale, tenant or site ObjectId');
      }
    }
    if (typeof entry.saleId === 'string') {
      if (seen.has(entry.saleId.toLowerCase())) add('Duplicate sale mapping');
      seen.add(entry.saleId.toLowerCase());
    }
    if (entry.historicalSourceVerified !== true ||
        typeof entry.privateProvenanceReference !== 'string' ||
        entry.privateProvenanceReference.trim().length < 12) {
      add('Each sale requires independent historical provenance');
    }
  }
  return {ready: errors.length === 0, errors: [...new Set(errors)]};
}

function run() {
  const filepath = process.env.GRUK_PRIVATE_REPAIR_MANIFEST;
  if (!filepath) throw new Error('Private manifest path required (no repository copies)');
  const manifest = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  const result = validate(manifest);
  // Print only aggregate status; identifiers and provenance stay private.
  process.stdout.write(JSON.stringify({
    readyForHumanReview: result.ready,
    mappedRows: Array.isArray(manifest.mappings) ? manifest.mappings.length : 0,
    missingRequirements: result.errors
  }) + '\n');
  if (!result.ready) process.exitCode = 1;
  // This tool can NEVER mutate production. Human/DBA migration is a separate gate.
}

if (require.main === module) run();
module.exports = { validate };
