'use strict';
// Plan Maestro 05 [P0] — replay coverage across all five enterprise lifecycles.
// Pure contract tests; not evidence of transactional persistence or end-to-end acceptance.
const test = require('node:test');
const assert = require('node:assert/strict');
const { replayEntityHistory } = require('../../core/gruk/enterprise-event-replay');
const { transition } = require('../../core/gruk/enterprise-state-contract');

const cases = [
  ['pedido', 'creado', ['preparando', 'listo', 'entregado']],
  ['pago', 'pendiente', ['autorizado', 'capturado', 'reembolsado']],
  ['inventario', 'reservado', ['consumido', 'revertido']],
  ['devolucion', 'solicitada', ['aprobada', 'ejecutada']],
  ['entrega', 'pendiente', ['en_camino', 'fallida', 'en_camino', 'entregada']]
];
for (const [tipo, initialState, targets] of cases) {
  test('P0-05 replays scoped lifecycle: ' + tipo, () => {
    const scope = { tipo, empresaId: 'empresaA', sedeId: 'sedeA', entidadId: 'entidadA' };
    let desde = initialState;
    const events = targets.map((hacia, i) => {
      const evento = transition({
        ...scope, actorId: 'actorA', eventoId: 'evento' + i,
        fecha: new Date(Date.UTC(2026, 10, 23, 9, i)).toISOString(),
        desde, hacia
      }).evento;
      desde = hacia;
      return evento;
    });
    const result = replayEntityHistory({ ...scope, initialState, events });
    assert.equal(result.finalState, targets.at(-1));
    assert.equal(result.eventCount, targets.length);
    assert.equal(replayEntityHistory({ ...scope, initialState, events: [events[0], events[0], ...events.slice(1)] }).eventCount, targets.length);
    assert.throws(() => replayEntityHistory({
      ...scope, initialState, events: [{ ...events[0], empresaId: 'empresaB' }, ...events.slice(1)]
    }), /P005_REPLAY_SCOPE_CRUZADO/);
    assert.throws(() => replayEntityHistory({
      ...scope, initialState, events: [events[0], { ...events[0], actorId: 'actorB' }, ...events.slice(1)]
    }), /P005_REPLAY_IDEMPOTENCIA_CONFLICTO/);
    assert.ok(Object.isFrozen(result.events));
    assert.ok(result.events.every(Object.isFrozen));
  });
}
