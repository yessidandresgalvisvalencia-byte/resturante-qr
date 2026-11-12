'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { hashMovement, ZERO_HASH } = require('../../core/ledger/appendLedger.service');
const { verifyLedgerChain } = require('../../core/ledger/verifyLedger.service');

const scope = Object.freeze({ empresaId: 'empresa-A', sedeId: 'sede-1', cuentaId: 'caja-1' });

function fixture() {
  const first = {
    ...scope, eventId: 'venta-1', secuencia: 1, tipo: 'CREDITO',
    amountCentavos: '1250', beforeCentavos: '0', afterCentavos: '1250',
    actorId: 'empleado-1', ip: '127.0.0.1', timestamp: new Date('2026-11-12T12:00:00Z'),
    hashAnterior: ZERO_HASH,
  };
  first.hash = hashMovement(first);
  const second = {
    ...scope, eventId: 'devolucion-1', secuencia: 2, tipo: 'DEBITO',
    amountCentavos: '250', beforeCentavos: '1250', afterCentavos: '1000',
    actorId: 'empleado-2', ip: '127.0.0.1', timestamp: new Date('2026-11-12T12:01:00Z'),
    hashAnterior: first.hash,
  };
  second.hash = hashMovement(second);
  return { movements: [first, second], head: { ...scope, secuencia: 2, balanceCentavos: '1000', lastHash: second.hash } };
}

test('P0-09 reconstructs exact COP balance and verifies every linked movement', () => {
  const { movements, head } = fixture();
  assert.deepEqual(verifyLedgerChain({ movements, head }), {
    valid: true, movimientos: 2, balanceCentavos: '1000', lastHash: head.lastHash,
  });
});

test('P0-09 rejects cross-tenant and cross-branch movement substitution', () => {
  for (const field of ['empresaId', 'sedeId', 'cuentaId']) {
    const data = fixture();
    data.movements[1][field] = 'foreign';
    data.movements[1].hash = hashMovement(data.movements[1]);
    assert.throws(() => verifyLedgerChain(data), /LEDGER_SCOPE_MISMATCH/);
  }
});

test('P0-09 rejects missing, reordered and tampered financial records', () => {
  const missing = fixture();
  missing.movements.shift();
  assert.throws(() => verifyLedgerChain(missing), /LEDGER_SEQUENCE_BROKEN/);

  const changedAmount = fixture();
  changedAmount.movements[1].amountCentavos = '251';
  assert.throws(() => verifyLedgerChain(changedAmount), /LEDGER_BALANCE_BROKEN/);

  const changedActor = fixture();
  changedActor.movements[1].actorId = 'intruder';
  assert.throws(() => verifyLedgerChain(changedActor), /LEDGER_HASH_BROKEN/);

  const changedLink = fixture();
  changedLink.movements[1].hashAnterior = ZERO_HASH;
  assert.throws(() => verifyLedgerChain(changedLink), /LEDGER_CHAIN_BROKEN/);
});

test('P0-09 rejects falsified journal head and invalid audit inputs', () => {
  const badHead = fixture();
  badHead.head.balanceCentavos = '999';
  assert.throws(() => verifyLedgerChain(badHead), /LEDGER_HEAD_MISMATCH/);

  const wrongHash = fixture();
  wrongHash.head.lastHash = ZERO_HASH;
  assert.throws(() => verifyLedgerChain(wrongHash), /LEDGER_HEAD_MISMATCH/);

  assert.throws(() => verifyLedgerChain({ movements: null, head: scope }), /LEDGER_INVALID_AUDIT_INPUT/);
});
