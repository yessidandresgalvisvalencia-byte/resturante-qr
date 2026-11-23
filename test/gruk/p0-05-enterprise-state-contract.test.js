'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {transition,transitions}=require('../../core/gruk/enterprise-state-contract');
const base={tipo:'pedido',desde:'creado',hacia:'preparando',empresaId:'empresaA',sedeId:'sede1',entidadId:'pedido1',actorId:'usuario1',eventoId:'evt1',fecha:'2026-11-22T10:00:00Z'};
test('P0-05 covers five enterprise lifecycles and all states have transition arrays',()=>{
  assert.deepEqual(Object.keys(transitions),['pedido','pago','inventario','devolucion','entrega']);
  for(const states of Object.values(transitions)) for(const targets of Object.values(states)) assert.ok(Array.isArray(targets));
});
test('P0-05 emits immutable tenant-scoped auditable event',()=>{
  const r=transition(base);
  assert.equal(r.evento.empresaId,'empresaA');
  assert.equal(r.evento.sedeId,'sede1');
  assert.equal(r.evento.estadoNuevo,undefined);
  assert.equal(r.evento.hacia,'preparando');
  assert.ok(Object.isFrozen(r.evento));
  assert.ok(Object.isFrozen(r));
});
test('P0-05 rejects illegal jumps and terminal state reopening',()=>{
  assert.throws(()=>transition({...base,hacia:'entregado'}),/P005_TRANSICION_PROHIBIDA/);
  assert.throws(()=>transition({...base,desde:'entregado',hacia:'creado'}),/P005_TRANSICION_PROHIBIDA/);
  assert.throws(()=>transition({...base,desde:'unknown'}),/P005_ESTADO_INVALIDO/);
});
test('P0-05 rejects missing or unsafe tenant, actor, entity and event identifiers',()=>{
  for(const field of ['empresaId','sedeId','entidadId','actorId','eventoId']) {
    for(const value of [undefined,'','../other','a/b',{}]) assert.throws(()=>transition({...base,[field]:value}),/P005_ID_INVALIDO/);
  }
});
test('P0-05 rejects invalid dates, supports deterministic retries without side effects',()=>{
  assert.throws(()=>transition({...base,fecha:'tomorrow'}),/P005_FECHA_INVALIDA/);
  assert.deepEqual(transition(base),transition(base));
});
test('P0-05 blocks double captures and repeated inventory consumption',()=>{
  assert.throws(()=>transition({...base,tipo:'pago',desde:'capturado',hacia:'capturado'}),/P005_TRANSICION_PROHIBIDA/);
  assert.throws(()=>transition({...base,tipo:'inventario',desde:'consumido',hacia:'consumido'}),/P005_TRANSICION_PROHIBIDA/);
});

test('P0-05 rejects rollover dates and invalid UTC clock values',()=>{
  for(const fecha of ['2026-02-30T10:00:00Z','2026-11-22T24:00:00Z','2026-11-22T10:60:00Z','2026-11-22T10:00:60Z'])
    assert.throws(()=>transition({...base,fecha}),/P005_FECHA_INVALIDA/);
});
test('P0-05 accepts canonical fractional UTC timestamps without changing audit evidence',()=>{
  for(const fecha of ['2026-11-22T10:00:00Z','2026-11-22T10:00:00.1Z','2026-11-22T10:00:00.12Z','2026-11-22T10:00:00.123Z'])
    assert.equal(transition({...base,fecha}).evento.fecha,fecha);
});
