'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { summarize } = require('../../scripts/gruk-enterprise-agent-audit');
test('summarizes PRs without claiming certification', () => {
  const output = summarize([{number:543,title:'Finance | reconciliation\nunsafe',draft:true,head:{sha:'abcdef0123456789'},html_url:'https://github.com/example/repo/pull/543'}]);
  assert.match(output, /#543 Finance   reconciliation unsafe/);
  assert.match(output, /NO acredita CI/);
  assert.doesNotMatch(output, /Finance \| reconciliation/);
});
test('accepts empty PR list', () => assert.match(summarize([]), /inspeccionados: 0/));
