'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../../routes/API.js'),'utf8');
test('P0 isolated route precedes legacy order route',()=>{
 const p0=src.indexOf('router.post("/pedido-p0"');
 const legacy=src.indexOf('router.post("/pedido"');
 assert.ok(p0>=0&&legacy>p0);
});
test('P0 route is guarded by rollout allowlist',()=>{
 const start=src.indexOf('router.post("/pedido-p0"'),end=src.indexOf('router.post("/pedido"',start);
 const route=src.slice(start,end);
 assert.match(route,/isP0PedidoEnabled\(\{restaurantId\}\)/);
 assert.match(route,/requireP0IdempotencyKey\(req\.headers\)/);
 assert.match(route,/registrarEventoEnTransaccion/);
 assert.match(route,/pedidoService\.crear/);
 assert.doesNotMatch(route,/io\.emit\(/);
});

test('P0 requires explicit restaurant scope and does not use rest1 fallback',()=>{
 const start=src.indexOf('router.post("/pedido-p0"');
 const end=src.indexOf('router.post("/pedido"',start);
 const route=src.slice(start,end);
 assert.match(route,/RESTAURANTE_EXPLICITO_REQUERIDO/);
 assert.doesNotMatch(route,/getRestaurantId\(req\)/);
});

test('P0 does not coerce object or array sede identifiers',()=>{
 const start=src.indexOf('router.post("/pedido-p0"');
 const end=src.indexOf('router.post("/pedido"',start);
 const route=src.slice(start,end);
 assert.match(route,/sedeId:req\.body\?\.sedeId===undefined\?"":req\.body\.sedeId/);
 assert.doesNotMatch(route,/sedeId:String\(req\.body/);
});
