'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { verifyLedgerChain } = require('../../core/ledger/verifyLedger.service');
const { ZERO_HASH } = require('../../core/ledger/appendLedger.service');

function emptyHead(overrides = {}) {
  return { empresaId: 'empresa-1', sedeId: 'sede_1', cuentaId: 'caja-1',
    secuencia: 0, balanceCentavos: '0', lastHash: ZERO_HASH, ...overrides };
}

test('P0-09 accepts a canonical empty ledger audit scope', () => {
  assert.equal(verifyLedgerChain({ movements: [], head: emptyHead() }).valid, true);
});

test('P0-09 rejects malformed enterprise, branch and account audit identifiers', () => {
  for (const field of ['empresaId', 'sedeId', 'cuentaId']) {
    for (const invalid of ['', ' ', 'tenant/other', 'tenant.other', 'a'.repeat(81), null, {}, '$ne']) {
      assert.throws(
        () => verifyLedgerChain({ movements: [], head: emptyHead({ [field]: invalid }) }),
        /LEDGER_INVALID_SCOPE/,
        field + ' must reject ' + String(invalid)
      );
    }
  }
});
