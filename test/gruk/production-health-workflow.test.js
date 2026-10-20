'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const readWorkflow = (name) => fs.readFileSync(path.join(root, '.github', 'workflows', name), 'utf8');

test('production health listens to a real CI workflow and only accepts success', () => {
  const health = readWorkflow('production-health.yml');
  const trigger = health.match(/workflows:\s*\["([^"]+)"\]/);
  assert.ok(trigger, 'production health must declare its upstream workflow');
  const files = fs.readdirSync(path.join(root, '.github', 'workflows')).filter((file) => /\.ya?ml$/.test(file));
  assert.ok(files.some((file) => readWorkflow(file).match(/^name:\s*(.+)$/m)?.[1].trim() === trigger[1]), 'the upstream workflow name must exist');
  assert.match(health, /workflow_run:/);
  assert.match(health, /workflow_run\.conclusion == 'success'/);
});

test('production health verifies readiness, connected DB, deployed commit and schedule', () => {
  const health = readWorkflow('production-health.yml');
  for (const required of ['workflow_dispatch:', 'schedule:', 'cron:', '/health', '/ready', 'r.ready !== true', 'r.db !== "connected"', 'h.db !== "connected"', 'h.commit !== process.env.EXPECTED_COMMIT']) {
    assert.ok(health.includes(required), `missing production health guard: ${required}`);
  }
  assert.match(health, /github\.event_name == 'schedule'/);
  assert.match(health, /\[0-9a-f\]\{40\}/);
});
