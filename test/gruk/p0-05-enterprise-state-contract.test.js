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

test('P0-05 transition policy cannot be mutated by runtime consumers',()=>{
  assert.ok(Object.isFrozen(transitions));
  for(const states of Object.values(transitions)) {
    assert.ok(Object.isFrozen(states));
    for(const targets of Object.values(states)) assert.ok(Object.isFrozen(targets));
  }
  assert.throws(()=>transitions.pago.capturado.push('capturado'),TypeError);
  assert.throws(()=>{transitions.inventario.consumido=['consumido'];},TypeError);
  assert.throws(()=>{transitions.pedido.entregado=['creado'];},TypeError);
  assert.throws(()=>transition({...base,tipo:'pago',desde:'capturado',hacia:'capturado'}),/P005_TRANSICION_PROHIBIDA/);
});

test('P0-05 fails closed on malformed payload and lifecycle state types',()=>{
  for (const payload of [null,undefined,false,0,'pedido',[],()=>{}])
    assert.throws(()=>transition(payload),/P005_PAYLOAD_INVALIDO/);
  for (const field of ['tipo','desde']) {
    for (const value of [null,{},[],0,Symbol('invalid')])
      assert.throws(()=>transition({...base,[field]:value}),/P005_ESTADO_INVALIDO/);
  }
  for (const value of [null,{},[],0,Symbol('invalid')])
    assert.throws(()=>transition({...base,hacia:value}),/P005_TRANSICION_PROHIBIDA/);
});

test('P0-05 rejects inherited tenant identity and incomplete own fields',()=>{
  const inherited=Object.create({empresaId:'empresaA'});
  Object.assign(inherited,base);
  delete inherited.empresaId;
  assert.throws(()=>transition(inherited),/P005_CAMPOS_INVALIDOS/);
  assert.throws(()=>transition({...base,empresaId:undefined}),/P005_ID_INVALIDO/);
  const missing={...base};
  delete missing.sedeId;
  assert.throws(()=>transition(missing),/P005_CAMPOS_INVALIDOS/);
});
test('P0-05 rejects unknown cross-tenant scope aliases and symbol fields',()=>{
  for(const field of ['tenantId','companyId','otraEmpresaId','__proto__'])
    assert.throws(()=>transition({...base,[field]:'empresaB'}),/P005_CAMPOS_INVALIDOS/);
  assert.throws(()=>transition({...base,[Symbol('scope')]:'empresaB'}),/P005_CAMPOS_INVALIDOS/);
});

test('P0-05 rejects accessor fields without invoking untrusted getters',()=>{
  for (const field of ['empresaId','sedeId','eventoId','tipo','fecha']) {
    let reads=0;
    const payload={...base};
    Object.defineProperty(payload,field,{enumerable:true,configurable:true,get(){reads++;throw Error('getter executed');}});
    assert.throws(()=>transition(payload),/P005_ACCESOR_PROHIBIDO/);
    assert.equal(reads,0);
  }
  const payload={...base};
  Object.defineProperty(payload,'actorId',{enumerable:true,configurable:true,set(_value){throw Error('setter executed');}});
  assert.throws(()=>transition(payload),/P005_ACCESOR_PROHIBIDO/);
});
