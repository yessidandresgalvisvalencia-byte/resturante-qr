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

test('failure in one tenant does not stop other tenants and forwards Socket.io',async()=>{
 const seen=[],errors=[],io={to(){return {emit(){}}}};
 const worker=iniciarConciliadorWompi({
  env:{...enabled,GRUK_P0_PEDIDOS_RESTAURANTES:'restaurant-a,restaurant-b'},
  io,intervalMs:15000,
  conciliar:async({restaurantId,io:givenIo})=>{
   assert.equal(givenIo,io);
   seen.push(restaurantId);
   if(restaurantId==='restaurant-a')throw new Error('SENSITIVE_PROVIDER_DETAILS');
  },
  onError:error=>errors.push(error)
 });
 try{
  for(let n=0;n<20&&seen.length<2;n++)await new Promise(resolve=>setTimeout(resolve,5));
  assert.deepEqual(seen,['restaurant-a','restaurant-b']);
  assert.deepEqual(errors,[{codigo:'CONCILIACION_RESTAURANTE_ERROR',restaurantId:'restaurant-a'}]);
  assert.equal(JSON.stringify(errors).includes('SENSITIVE_PROVIDER_DETAILS'),false);
 }finally{worker.stop();}
});
