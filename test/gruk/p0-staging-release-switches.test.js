'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {isP0PedidoEnabled}=require('../../services/p0/pedidoFeatureFlag');
const conciliador=require('../../services/p0/conciliadorWompi.worker');
const outbox=require('../../services/p0/outbox.worker');

test('production cannot enable P0 checkout, reconciliation, or outbox even with all flags set',()=>{
 const env={
  NODE_ENV:'production',
  GRUK_P0_PEDIDOS_ENABLED:'true',
  GRUK_P0_PEDIDOS_RESTAURANTES:'tenant-authorized',
  GRUK_P0_WOMPI_RECONCILER_ENABLED:'true',
  GRUK_P0_OUTBOX_WORKER_ENABLED:'true'
 };
 assert.equal(isP0PedidoEnabled({env,restaurantId:'tenant-authorized'}),false);
 assert.equal(conciliador.habilitado(env),false);
 assert.equal(outbox.habilitado(env),false);
 assert.equal(conciliador.iniciarConciliadorWompi({env}).started,false);
 assert.equal(outbox.iniciarOutboxWorker({env}).started,false);
});
test('P0 staging activation requires explicit tenant allowlist and all independent switches',()=>{
 const env={
  NODE_ENV:'staging',
  GRUK_P0_PEDIDOS_ENABLED:'true',
  GRUK_P0_PEDIDOS_RESTAURANTES:'tenant-authorized',
  GRUK_P0_WOMPI_RECONCILER_ENABLED:'true',
  GRUK_P0_OUTBOX_WORKER_ENABLED:'true'
 };
 assert.equal(isP0PedidoEnabled({env,restaurantId:'tenant-authorized'}),true);
 assert.equal(isP0PedidoEnabled({env,restaurantId:'tenant-other'}),false);
 assert.equal(conciliador.habilitado(env),true);
 assert.equal(outbox.habilitado(env),true);
 assert.equal(conciliador.habilitado({...env,GRUK_P0_WOMPI_RECONCILER_ENABLED:'false'}),false);
 assert.equal(outbox.habilitado({...env,GRUK_P0_OUTBOX_WORKER_ENABLED:'false'}),false);
 assert.equal(isP0PedidoEnabled({env:{...env,GRUK_P0_PEDIDOS_RESTAURANTES:''},restaurantId:'tenant-authorized'}),false);
});
