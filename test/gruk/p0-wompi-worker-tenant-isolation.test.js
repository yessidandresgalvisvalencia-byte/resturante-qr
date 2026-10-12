'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {iniciarConciliadorWompi}=require('../../services/p0/conciliadorWompi.worker');
test('worker isolates failures per restaurant and redacts provider secrets',async()=>{
 const visited=[],diagnostics=[],io={to(){return {emit(){}}}};
 const env={NODE_ENV:'test',GRUK_P0_PEDIDOS_ENABLED:'true',
  GRUK_P0_WOMPI_RECONCILER_ENABLED:'true',
  GRUK_P0_PEDIDOS_RESTAURANTES:'one,two'};
 const worker=iniciarConciliadorWompi({env,io,intervalMs:15000,
  conciliar:async({restaurantId,io:socket})=>{
   assert.equal(socket,io);
   visited.push(restaurantId);
   if(restaurantId==='one')throw new Error('gateway-secret-response');
  },onError:e=>diagnostics.push(e)});
 try{
  for(let i=0;i<40&&visited.length<2;i++)await new Promise(resolve=>setTimeout(resolve,5));
  assert.deepEqual(visited,['one','two']);
  assert.deepEqual(diagnostics,[{codigo:'CONCILIACION_RESTAURANTE_ERROR',restaurantId:'one'}]);
  assert.equal(JSON.stringify(diagnostics).includes('gateway-secret-response'),false);
 }finally{worker.stop();}
});
