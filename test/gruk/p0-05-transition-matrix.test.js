'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { transition, transitions } = require('../../core/gruk/enterprise-state-contract');

// P0-05 partial acceptance: exhaustive pure state-machine contract regression.
// This is not evidence of durable idempotency, atomic persistence, or E2E coverage.
const base = Object.freeze({
  empresaId: 'empresaA', sedeId: 'sede1', entidadId: 'entidad1',
  actorId: 'actor1', eventoId: 'evt1', fecha: '2026-11-23T06:00:00Z'
});

test('P0-05 exhaustively enforces the declared transition matrix', () => {
  for (const [tipo, states] of Object.entries(transitions)) {
    const allStates = Object.keys(states);
    for (const [desde, allowed] of Object.entries(states)) {
      assert.equal(new Set(allowed).size, allowed.length, tipo + '/' + desde + ': duplicate target');
      for (const hacia of allStates) {
        const input = { ...base, tipo, desde, hacia };
        if (allowed.includes(hacia)) {
          const result = transition(input);
          assert.equal(result.estadoAnterior, desde);
          assert.equal(result.estadoNuevo, hacia);
          assert.deepEqual(
            [result.evento.empresaId, result.evento.sedeId, result.evento.entidadId],
            [base.empresaId, base.sedeId, base.entidadId]
          );
        } else {
          assert.throws(() => transition(input), /P005_TRANSICION_PROHIBIDA/, tipo + '/' + desde + ' -> ' + hacia);
        }
      }
    }
  }
});

test('P0-05 never silently changes tenant or entity identifiers in audit event', () => {
  for (const empresaId of ['empresaA', 'empresaB']) {
    for (const sedeId of ['sede1', 'sede2']) {
      const input = { ...base, tipo: 'pago', desde: 'autorizado', hacia: 'capturado', empresaId, sedeId };
      const output = transition(input);
      assert.equal(output.empresaId, empresaId);
      assert.equal(output.sedeId, sedeId);
      assert.equal(output.evento.empresaId, empresaId);
      assert.equal(output.evento.sedeId, sedeId);
      assert.equal(output.evento.eventoId, base.eventoId);
    }
  }
});
