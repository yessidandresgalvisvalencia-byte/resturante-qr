'use strict';

// P0 supply-chain guard: reject drift between the production manifest and lockfile.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));

test('lockfile root records exactly the declared production dependencies and overrides', () => {
  assert.equal(lock.lockfileVersion, 3);
  assert.ok(lock.packages && lock.packages[''], 'missing lockfile root');
  const locked = lock.packages[''];
  assert.deepEqual(locked.dependencies || {}, manifest.dependencies || {});
  assert.deepEqual(locked.optionalDependencies || {}, manifest.optionalDependencies || {});
  assert.deepEqual(locked.devDependencies || {}, manifest.devDependencies || {});
  assert.deepEqual(locked.engines || {}, manifest.engines || {});
});

test('each direct production dependency is represented by a locked package', () => {
  for (const name of Object.keys(manifest.dependencies || {})) {
    const entry = lock.packages['node_modules/' + name];
    assert.ok(entry, 'missing locked production package: ' + name);
    assert.ok(typeof entry.version === 'string' && entry.version.length > 0,
      'missing locked version for ' + name);
  }
});

test('registry tarballs are pinned to an integrity digest', () => {
  for (const [name, entry] of Object.entries(lock.packages)) {
    if (!name || !entry.resolved) continue;
    if (!entry.resolved.startsWith('https://registry.npmjs.org/')) continue;
    assert.match(entry.integrity || '', /^sha(256|384|512)-[A-Za-z0-9+/=]+$/,
      'missing or malformed integrity digest for ' + name);
  }
});

test('production dependencies cannot use mutable remote or local sources', () => {
  for (const [name, spec] of Object.entries(manifest.dependencies || {})) {
    assert.doesNotMatch(spec, /^(?:git(?:\+|:)|https?:|file:|link:|workspace:)/i,
      'unreviewed dependency source for ' + name);
  }
});
