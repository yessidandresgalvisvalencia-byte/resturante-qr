'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {iniciarConciliadorWompi,habilitado}=require('../../services/p0/conciliadorWompi.worker');
const enabled={NODE_ENV:'test',GRUK_P0_PEDIDOS_ENABLED:'true',GRUK_P0_WOMPI_RECONCILER_ENABLED:'true',GRUK_P0_PEDIDOS_RESTAURANTES:'restaurant-a'};
test('reconciliation worker is disabled by default and in production',()=>{
 assert.equal(habilitado({}),false);
 assert.equal(habilitado({...enabled,NODE_ENV:'production'}),false);
 assert.equal(iniciarConciliadorWompi({env:{}}).started,false);
});
test('reconciliation worker validates bounded interval and batch',()=>{
 assert.throws(()=>iniciarConciliadorWompi({env:enabled,intervalMs:100}),/CONCILIACION_INTERVALO_INVALIDO/);
 assert.throws(()=>iniciarConciliadorWompi({env:enabled,limit:101}),/CONCILIACION_LIMITE_INVALIDO/);
});
test('reconciliation worker deduplicates allowlist and does not overlap pending cycles',async()=>{
 const seen=[];
 const worker=iniciarConciliadorWompi({
  env:{...enabled,GRUK_P0_PEDIDOS_RESTAURANTES:'restaurant-a,restaurant-a,restaurant-b'},
  intervalMs:15000,conciliar:async({restaurantId,limit})=>{seen.push([restaurantId,limit]);}
 });
 try{
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(seen,[['restaurant-a',20],['restaurant-b',20]]);
 }finally{worker.stop();}
});
