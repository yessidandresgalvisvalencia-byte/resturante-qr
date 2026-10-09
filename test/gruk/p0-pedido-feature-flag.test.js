'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {isP0PedidoEnabled,requireP0IdempotencyKey}=require('../../services/p0/pedidoFeatureFlag');
test('flag apagado por defecto',()=>assert.equal(isP0PedidoEnabled({env:{},restaurantId:'yessid'}),false));
test('flag prendido sin allowlist no activa ningun restaurante',()=>assert.equal(isP0PedidoEnabled({env:{GRUK_P0_PEDIDOS_ENABLED:'true'},restaurantId:'yessid'}),false));
test('flag activado solo permite restaurante explicitamente autorizado',()=>{
 const env={GRUK_P0_PEDIDOS_ENABLED:'true',GRUK_P0_PEDIDOS_RESTAURANTES:'piloto1,piloto2'};
 assert.equal(isP0PedidoEnabled({env,restaurantId:'piloto1'}),true);
 assert.equal(isP0PedidoEnabled({env,restaurantId:'yessid'}),false);
});
test('cabecera de idempotencia valida',()=>assert.equal(requireP0IdempotencyKey({'idempotency-key':'abcdefghijklmnop'}),'abcdefghijklmnop'));
test('cabecera ausente rechazada',()=>assert.throws(()=>requireP0IdempotencyKey({}),{statusCode:428}));
test('clave demasiado corta rechazada',()=>assert.throws(()=>requireP0IdempotencyKey({'idempotency-key':'abc'}),{statusCode:428}));
