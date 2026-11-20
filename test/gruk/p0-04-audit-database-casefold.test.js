'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const { join } = require('node:path');

const workflow = readFileSync(join(__dirname, '../../.github/workflows/gruk-enterprise-money-readonly-audit.yml'), 'utf8');
const guardLine = workflow.split('\n').find(line => line.includes('Invalid enterprise database name') === false && line.includes('DB_NAME') && line.includes('=~'));
assert.ok(guardLine, 'enterprise database guard must exist');

function allowed(name) {
  const script = 'DB_NAME="$1"\n' + guardLine.trim().replace(/; then$/, '; then') + '\n  exit 1\nfi\n';
  const result = spawnSync('bash', ['-c', script, 'audit-guard', name], { encoding: 'utf8' });
  assert.equal(result.error, undefined);
  return result.status === 0;
}

test('P0-04 enterprise money audit rejects reserved database names regardless of case', () => {
  for (const name of ['BlusheaProd', 'BLUSHEA', 'FinanzasPersonales', 'PERSONAL_data', 'AdMiNStore', 'CONFIG_DB', 'TEST_DB', 'LocalData']) {
    assert.equal(allowed(name), false, name);
  }
});

test('P0-04 enterprise money audit accepts a valid enterprise database name only', () => {
  assert.equal(allowed('gruk_empresa_01'), true);
  for (const name of ['a', '1empresa', 'empresa.name', 'empresa espacio']) {
    assert.equal(allowed(name), false, name);
  }
});

// The name is passed as a positional argument, never interpolated into shell source.
test('P0-04 audit guard rejects shell metacharacters and control characters', () => {
  for (const name of ['gruk;echo unsafe', 'gruk$(id)', 'gruk`id`', 'gruk\nother', 'gruk/other', 'gruk\\other', 'gruk"other', "gruk'other", 'gruk*other']) {
    assert.equal(allowed(name), false, JSON.stringify(name));
  }
});

test('P0-04 audit guard enforces exact database-name length boundaries', () => {
  assert.equal(allowed('ab'), true, 'minimum permitted length is 2');
  assert.equal(allowed('a'.repeat(63)), true, 'maximum permitted length is 63');
  assert.equal(allowed('a'.repeat(64)), false, '64 characters must be denied');
  assert.equal(allowed(''), false, 'empty database name must be denied');
  assert.equal(allowed('a'.repeat(1000)), false, 'oversized input must be denied');
});

test('P0-04 audit guard rejects embedded reserved tokens and unicode lookalikes', () => {
  for (const name of [
    'gruk_BLUSHEA_backup',
    'gruk_PeRsOnAl_archive',
    'gruk_FiNaNzAs_2026',
    'gruk_AdMiN_copy',
    'gruk_CONFIG_archive',
    'gruk_TEST_restore',
    'gruk_LOCAL_clone',
    'gruk_émpresa',
    'gruk＿empresa',
    'gruk\tenterprise',
    'gruk\renterprise',
  ]) {
    assert.equal(allowed(name), false, JSON.stringify(name));
  }
});
