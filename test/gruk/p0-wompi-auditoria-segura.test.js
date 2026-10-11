'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {crearConciliadorWompi,codigoConfirmacion}=require('../../services/p0/conciliarPendientesWompi');
test('only approved diagnostic codes may be persisted',()=>{
 assert.equal(codigoConfirmacion('INTEGRIDAD_ECONOMICA_INVALIDA'),'INTEGRIDAD_ECONOMICA_INVALIDA');
 assert.equal(codigoConfirmacion('secret-card-or-provider-response'),'CONFIRMACION_FALLIDA');
 assert.equal(codigoConfirmacion(undefined),'CONFIRMACION_FALLIDA');
});
test('provider exception never leaks secrets into stored audit or logs',async()=>{
 const secret='sensitive-provider-payment-data';
 const attempt={_id:'attempt1',reference:'GRUK_PEDIDO_123',transactionId:'txn123',conciliacionIntentos:0};
 const written=[];const logs=[];
 const model={
  find(){return {sort(){return {limit(){return {lean:async()=>[attempt]};}}}}},
  async findOneAndUpdate(){return attempt;},
  async updateOne(query,operation){written.push(operation.$set);return {modifiedCount:1};}
 };
 const original=console.error;
 console.error=(...args)=>logs.push(args.map(x=>JSON.stringify(x)).join(' '));
 try{
  const reconcile=crearConciliadorWompi({IntentoModel:model,habilitado:()=>true,consultar:async()=>{throw new Error(secret);}});
  const result=await reconcile({restaurantId:'tenant'});
  assert.equal(result.failed,1);
  assert.equal(written[0].conciliacionUltimoError,'CONSULTA_O_CONFIRMACION_ERROR');
  assert.ok(written[0].conciliacionReintentoAt instanceof Date);
  assert.equal((JSON.stringify(written)+JSON.stringify(logs)).includes(secret),false);
 }finally{console.error=original;}
});
