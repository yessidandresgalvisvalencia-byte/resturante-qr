'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {iniciarConciliadorWompi,habilitado}=require('../../services/p0/conciliadorWompi.worker');
const {isP0PedidoEnabled}=require('../../services/p0/pedidoFeatureFlag');

test('Wompi staging gate stays fail-closed for production even when every flag is true',()=>{
 const env={NODE_ENV:'production',GRUK_P0_PEDIDOS_ENABLED:'true',GRUK_P0_WOMPI_RECONCILER_ENABLED:'true',GRUK_P0_PEDIDOS_RESTAURANTES:'tenant'};
 assert.equal(isP0PedidoEnabled({env,restaurantId:'tenant'}),false);
 assert.equal(habilitado(env),false);
 const result=iniciarConciliadorWompi({env,conciliar:async()=>{throw Error('MUST_NOT_RUN');}});
 assert.equal(result.started,false);
 result.stop();
});
test('Wompi staging gate refuses missing tenant allowlist or missing independent worker switch',()=>{
 for(const env of [
  {NODE_ENV:'staging',GRUK_P0_PEDIDOS_ENABLED:'true',GRUK_P0_WOMPI_RECONCILER_ENABLED:'true'},
  {NODE_ENV:'staging',GRUK_P0_PEDIDOS_ENABLED:'true',GRUK_P0_PEDIDOS_RESTAURANTES:'tenant'},
  {NODE_ENV:'staging',GRUK_P0_WOMPI_RECONCILER_ENABLED:'true',GRUK_P0_PEDIDOS_RESTAURANTES:'tenant'}
 ]){
  assert.equal(habilitado(env),false);
  assert.equal(iniciarConciliadorWompi({env}).started,false);
 }
});
