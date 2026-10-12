'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {crearConciliadorWompi}=require('../../services/p0/conciliarPendientesWompi');
function findRows(rows){return {sort(){return {limit(){return {lean:async()=>rows};}}}};}
test('claim persistence failure does not query Wompi and reports failed reconciliation',async()=>{
 let consulted=0;
 const attempt={_id:'a1',reference:'GRUK_PEDIDO_1',transactionId:'tx1',amountInCents:10000,currency:'COP'};
 const Model={find:()=>findRows([attempt]),async findOneAndUpdate(){throw Error('DB failure token-secret')}};
 const run=crearConciliadorWompi({IntentoModel:Model,habilitado:()=>true,consultar:async()=>{consulted++;}});
 const old=console.error;const messages=[];console.error=(...args)=>messages.push(args);
 try{
  const result=await run({restaurantId:'tenant'});
  assert.equal(result.failed,1);assert.equal(result.checked,0);assert.equal(consulted,0);
  assert.ok(!JSON.stringify(messages).includes('token-secret'));
 }finally{console.error=old;}
});
test('failed audit persistence can be retried after lease expiration without a second charge',async()=>{
 const attempt={_id:'a1',reference:'GRUK_PEDIDO_1',transactionId:'tx1',amountInCents:10000,currency:'COP'};
 let consultations=0,confirmations=0;
 const Model={
  find:()=>findRows([attempt]),
  async findOneAndUpdate(){return attempt;},
  findOne(){return {lean:async()=>attempt};},
  async updateOne(){throw Error('MongoDB write failure secret');}
 };
 const run=crearConciliadorWompi({IntentoModel:Model,habilitado:()=>true,
  consultar:async()=>{consultations++;return {id:'tx1',reference:attempt.reference,status:'APPROVED',amount_in_cents:10000,currency:'COP'};},
  confirmar:async()=>{confirmations++;return {handled:true,ok:true,estado:'APROBADO'};}});
 const old=console.error;const messages=[];console.error=(...args)=>messages.push(args);
 try{
  const result=await run({restaurantId:'tenant'});
  assert.equal(result.approved,1);assert.equal(result.failed,1);
  assert.equal(consultations,1);assert.equal(confirmations,1);
  assert.ok(!JSON.stringify(messages).includes('secret'));
 }finally{console.error=old;}
});
