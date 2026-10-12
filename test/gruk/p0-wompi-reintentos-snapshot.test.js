'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {crearConciliadorWompi}=require('../../services/p0/conciliarPendientesWompi');

test('retry counter uses claimed MongoDB state, not stale pre-claim scan',async()=>{
 const scanned={_id:'attempt1',reference:'GRUK_PEDIDO_1',transactionId:'tx1',amountInCents:10000,currency:'COP',conciliacionIntentos:1};
 const claimed={...scanned,conciliacionIntentos:5};
 let persisted=null;
 const Model={
  find(){return {sort(){return {limit(){return {lean:async()=>[scanned]};}}}}},
  async findOneAndUpdate(){return claimed;},
  findOne(){return {lean:async()=>claimed};},
  async updateOne(query,operation){persisted=operation.$set;return {modifiedCount:1};}
 };
 const run=crearConciliadorWompi({
  IntentoModel:Model,habilitado:()=>true,
  consultar:async()=>({id:'tx1',reference:scanned.reference,amount_in_cents:10000,currency:'COP',status:'PENDING'}),
  confirmar:async()=>({handled:true,ok:true,estado:'PENDIENTE'})
 });
 const result=await run({restaurantId:'test'});
 assert.equal(result.checked,1);
 assert.equal(result.unchanged,1);
 assert.equal(persisted.conciliacionIntentos,6);
 const delay=persisted.conciliacionReintentoAt.getTime()-Date.now();
 assert.ok(delay>900000&&delay<=1000000);
});
