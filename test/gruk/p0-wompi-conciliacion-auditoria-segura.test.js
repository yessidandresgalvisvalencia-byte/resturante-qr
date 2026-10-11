'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {codigoConfirmacion,crearConciliadorWompi}=require('../../services/p0/conciliarPendientesWompi');
test('payment reconciliation audit accepts only controlled error codes',()=>{
 assert.equal(codigoConfirmacion('CONCILIACION_RESERVA_PERDIDA'),'CONCILIACION_RESERVA_PERDIDA');
 assert.equal(codigoConfirmacion('https://api.example/private?token=secret'),'CONFIRMACION_FALLIDA');
 assert.equal(codigoConfirmacion(undefined),'CONFIRMACION_FALLIDA');
});
test('remote provider exception is classified without persisting sensitive details',async()=>{
 const updates=[];
 const attempt={_id:'id1',restaurantId:'allow',reference:'GRUK_PEDIDO_1',transactionId:'txn1'};
 const Model={
  find(){return {sort(){return {limit(){return {lean:async()=>[attempt]};}}}}},
  async findOneAndUpdate(){return attempt;},
  async updateOne(query,operation){updates.push(operation.$set);return {modifiedCount:1};}
 };
 const original=console.error;console.error=()=>{};
 try{
  const run=crearConciliadorWompi({IntentoModel:Model,habilitado:()=>true,
   consultar:async()=>{throw new Error('SECRET_ACCESS_TOKEN=private-value');}});
  const result=await run({restaurantId:'allow'});
  assert.equal(result.failed,1);
  assert.equal(updates[0].conciliacionUltimoError,'CONSULTA_O_CONFIRMACION_ERROR');
  assert.equal(JSON.stringify(updates).includes('private-value'),false);
 }finally{console.error=original;}
});
