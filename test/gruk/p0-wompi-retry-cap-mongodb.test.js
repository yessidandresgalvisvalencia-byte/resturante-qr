'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const mongoose=require('mongoose');
const Intento=require('../../models/IntentoPagoPedido');
const {crearConciliadorWompi,MAX_INTENTOS_AUTOMATICOS}=require('../../services/p0/conciliarPendientesWompi');

test('MongoDB: exhausted automatic reconciliation attempts are not queried or claimed',{timeout:40000},async t=>{
 if(!process.env.TEST_MONGO_URI){t.skip('Requires TEST_MONGO_URI');return;}
 const conn=mongoose.createConnection(process.env.TEST_MONGO_URI,{
  dbName:'gruk_p0_reconcile_cap_'+process.pid,serverSelectionTimeoutMS:10000
 });
 await conn.asPromise();
 const Attempt=conn.model(Intento.modelName,Intento.schema);
 const reference='GRUK_PEDIDO_'+new mongoose.Types.ObjectId();
 let providerCalls=0,confirmationCalls=0;
 const reconcile=crearConciliadorWompi({
  IntentoModel:Attempt,
  habilitado:()=>true,
  consultar:async()=>{providerCalls++;throw Error('UNEXPECTED_GATEWAY_CALL');},
  confirmar:async()=>{confirmationCalls++;throw Error('UNEXPECTED_PAYMENT_CONFIRMATION');}
 });
 try{
  await Attempt.init();
  const attempt=await Attempt.create({reference,restaurantId:'retry-cap-test',
   pedidoIds:[new mongoose.Types.ObjectId()],amountInCents:10000,
   transactionId:'tx-retry-cap',estado:'PENDIENTE',conciliacionIntentos:MAX_INTENTOS_AUTOMATICOS,
   conciliacionReintentoAt:new Date(Date.now()-1000)});
  const result=await reconcile({restaurantId:'retry-cap-test'});
  assert.deepEqual(result,{checked:0,approved:0,unchanged:0,failed:0});
  assert.equal(providerCalls,0);
  assert.equal(confirmationCalls,0);
  const stored=await Attempt.findById(attempt._id).lean();
  assert.equal(stored.conciliacionIntentos,MAX_INTENTOS_AUTOMATICOS);
  assert.equal(stored.conciliacionToken,null);
  assert.equal(stored.estado,'PENDIENTE');
 }finally{
  await conn.dropDatabase();await conn.close();
 }
});
