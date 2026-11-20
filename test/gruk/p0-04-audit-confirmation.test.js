'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const { join } = require('node:path');
const workflow = readFileSync(join(__dirname, '../../.github/workflows/gruk-enterprise-money-readonly-audit.yml'), 'utf8');
const start = workflow.indexOf('          if [[ -z "$GRUK_ENTERPRISE_MONGO_URI" ]]');
const end = workflow.indexOf('          echo "Validation passed;', start);
assert.ok(start >= 0 && end > start, 'credential and confirmation preflight required');
const script = 'set -euo pipefail\n' + workflow.slice(start, end) + '\n';
function check(overrides = {}) {
  const env = { PATH: process.env.PATH, DB_NAME: 'gruk_empresa_01', DB_CONFIRM: 'gruk_empresa_01', APPROVAL: 'CONFIRMO_SOLO_LECTURA', GRUK_ENTERPRISE_MONGO_URI: 'mongodb://example.invalid:27017', ...overrides };
  const result = spawnSync('bash', ['-c', script], { env, encoding: 'utf8' });
  assert.equal(result.error, undefined);
  return result.status;
}
test('P0-04 manual audit requires credential, exact DB confirmation and explicit authorization', () => {
  assert.equal(check(), 0);
  assert.notEqual(check({ GRUK_ENTERPRISE_MONGO_URI: '' }), 0);
  assert.notEqual(check({ DB_CONFIRM: 'gruk_empresa_02' }), 0);
  assert.notEqual(check({ DB_CONFIRM: 'GRUK_EMPRESA_01' }), 0);
  assert.notEqual(check({ APPROVAL: '' }), 0);
  assert.notEqual(check({ APPROVAL: 'confirmo_solo_lectura' }), 0);
  assert.notEqual(check({ DB_NAME: 'BlusheaProd', DB_CONFIRM: 'BlusheaProd' }), 0);
});
