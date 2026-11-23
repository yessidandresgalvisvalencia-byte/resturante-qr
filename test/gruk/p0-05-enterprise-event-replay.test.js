'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { replayEntityHistory } = require('../../core/gruk/enterprise-event-replay');
const { transition } = require('../../core/gruk/enterprise-state-contract');
const scope = { tipo: 'pedido', empresaId: 'empresaA', sedeId: 'sede1', entidadId: 'pedido1', initialState: 'creado' };
const event = (eventoId, desde, hacia, extra = {}) => transition({
  tipo: 'pedido', empresaId: 'empresaA', sedeId: 'sede1', entidadId: 'pedido1',
  actorId: 'actor1', fecha: '2026-11-23T09:00:00Z', eventoId, desde, hacia, ...extra
}).evento;
const replay = events => replayEntityHistory({ ...scope, events });

test('P0-05 replays valid state chain without mutating input', () => {
  const events = [event('e1','creado','preparando'), event('e2','preparando','listo'), event('e3','listo','entregado')];
  const result = replay(events);
  assert.equal(result.finalState, 'entregado');
  assert.equal(result.eventCount, 3);
  assert.deepEqual(result.events, events);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.events));
  assert.equal(events.length, 3);
});
test('P0-05 exact redelivery is a no-op but conflicting event IDs fail closed', () => {
  const e = event('e1','creado','preparando');
  assert.equal(replay([e, { ...e }]).eventCount, 1);
  assert.throws(() => replay([e, { ...e, actorId: 'actor2' }]), /P005_REPLAY_IDEMPOTENCIA_CONFLICTO/);
});
test('P0-05 rejects missing transitions and reordered history', () => {
  const first = event('e1','creado','preparando');
  const second = event('e2','preparando','listo');
  assert.throws(() => replay([second]), /P005_REPLAY_SECUENCIA_INVALIDA/);
  assert.throws(() => replay([first, first, event('e3','creado','cancelado')]), /P005_REPLAY_SECUENCIA_INVALIDA/);
});
test('P0-05 rejects cross-company, cross-branch and cross-entity events', () => {
  const e = event('e1','creado','preparando');
  for (const field of ['empresaId','sedeId','entidadId'])
    assert.throws(() => replay([{ ...e, [field]: 'other' }]), /P005_REPLAY_SCOPE_CRUZADO/);
});
test('P0-05 rejects noncanonical audit fields, accessors and invalid scope', () => {
  const e = event('e1','creado','preparando');
  assert.throws(() => replay([{ ...e, tenantId: 'other' }]), /P005_REPLAY_EVENTO_INVALIDO/);
  const getter = { ...e };
  Object.defineProperty(getter,'empresaId',{ enumerable: true, get(){ throw Error('unsafe'); } });
  assert.throws(() => replay([getter]), /P005_ACCESOR_PROHIBIDO/);
  assert.throws(() => replayEntityHistory({ ...scope, empresaId: '../bad', events: [] }), /P005_REPLAY_SCOPE_INVALIDO/);
  assert.throws(() => replayEntityHistory({ ...scope, events: {} }), /P005_REPLAY_EVENTOS_INVALIDOS/);
});
test('P0-05 rejects regressive timestamps', () => {
  const first = event('e1','creado','preparando', {fecha:'2026-11-23T10:00:00Z'});
  const second = event('e2','preparando','listo', {fecha:'2026-11-23T09:00:00Z'});
  assert.throws(() => replay([first,second]), /P005_REPLAY_TIEMPO_REGRESIVO/);
});
