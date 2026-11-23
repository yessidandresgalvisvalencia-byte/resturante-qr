'use strict';
// Plan Maestro 05 [P0]: deterministic verification of a single entity's event history.
// Read-only primitive. Persistence, transactions and durable idempotency remain separate gates.
const { transition, transitions } = require('./enterprise-state-contract');

function replayEntityHistory({ tipo, empresaId, sedeId, entidadId, initialState, events }) {
  if (typeof tipo !== 'string' || !Object.hasOwn(transitions, tipo) ||
      typeof initialState !== 'string' || !Object.hasOwn(transitions[tipo], initialState))
    throw new TypeError('P005_REPLAY_ESTADO_INVALIDO');
  if (!Array.isArray(events)) throw new TypeError('P005_REPLAY_EVENTOS_INVALIDOS');
  // Validate identity even for empty histories by validating a synthetic transition?
  // Identifiers must be checked directly because an empty history has no events to validate.
  const validId = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(value);
  if (![empresaId, sedeId, entidadId].every(validId))
    throw new TypeError('P005_REPLAY_SCOPE_INVALIDO');
  let state = initialState;
  let previousTime = -Infinity;
  const seen = new Map();
  const accepted = [];
  for (const event of events) {
    // Accept only the exact persisted audit event schema, not arbitrary extra scope aliases.
    if (event === null || typeof event !== 'object' || Array.isArray(event) ||
        Object.getPrototypeOf(event) !== Object.prototype ||
        Reflect.ownKeys(event).length !== 9 ||
        !['eventoId','tipo','empresaId','sedeId','entidadId','actorId','fecha','desde','hacia']
          .every(k => Object.hasOwn(event,k)))
      throw new TypeError('P005_REPLAY_EVENTO_INVALIDO');
    const result = transition(event);
    const e = result.evento;
    if (e.tipo !== tipo || e.empresaId !== empresaId ||
        e.sedeId !== sedeId || e.entidadId !== entidadId)
      throw new Error('P005_REPLAY_SCOPE_CRUZADO');
    const canonical = JSON.stringify(e);
    if (seen.has(e.eventoId)) {
      if (seen.get(e.eventoId) !== canonical)
        throw new Error('P005_REPLAY_IDEMPOTENCIA_CONFLICTO');
      continue; // Exact redelivery is a no-op, not a second financial/stock mutation.
    }
    if (e.desde !== state) throw new Error('P005_REPLAY_SECUENCIA_INVALIDA');
    const timestamp = Date.parse(e.fecha);
    if (timestamp < previousTime) throw new Error('P005_REPLAY_TIEMPO_REGRESIVO');
    seen.set(e.eventoId, canonical);
    accepted.push(e);
    state = e.hacia;
    previousTime = timestamp;
  }
  return Object.freeze({ tipo, empresaId, sedeId, entidadId, initialState,
    finalState: state, eventCount: accepted.length, events: Object.freeze(accepted) });
}
module.exports = { replayEntityHistory };
