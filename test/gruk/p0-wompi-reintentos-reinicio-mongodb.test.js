'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const mongoose=require('mongoose');
const Intento=require('../../models/IntentoPagoPedido');
const {crearConciliadorWompi}=require('../../services/p0/conciliarPendientesWompi');

test('Wompi persists retry schedule across independent reconciler restarts',{timeout:40000},async t=>{
 if(!process.env.TEST_MONGO_URI){t.skip('Requires MongoDB');return;}
 const conn=mongoose.createConnection(process.env.TEST_MONGO_URI,{
  dbName:'gruk_p0_retry_restart_'+process.pid,serverSelectionTimeoutMS:10000
 });
 await conn.asPromise();
 const Attempt=conn.model(Intento.modelName,Intento.schema);
 const reference='GRUK_PEDIDO_'+new mongoose.Types.ObjectId();
 let lookups=0;
 const makeWorker=()=>crearConciliadorWompi({
  IntentoModel:Attempt,
  habilitado:()=>true,
  consultar:async id=>{lookups++;return {id,reference,status:'PENDING',amount_in_cents:10000,currency:'COP'};},
  confirmar:async()=>({handled:true,ok:true,estado:'PENDIENTE'})
 });
 try{
  await Attempt.init();
  const attempt=await Attempt.create({reference,restaurantId:'restart-tenant',
   pedidoIds:[new mongoose.Types.ObjectId()],amountInCents:10000,
   transactionId:'tx-retry-restart',estado:'PENDIENTE'});
  const first=await makeWorker()({restaurantId:'restart-tenant'});
  assert.equal(first.checked,1);
  assert.equal(lookups,1);
  const saved=await Attempt.findById(attempt._id).lean();
  assert.equal(saved.conciliacionIntentos,1);
  assert.ok(saved.conciliacionReintentoAt>new Date());
  // A newly constructed reconciler has no in-memory history.
  const restarted=await makeWorker()({restaurantId:'restart-tenant'});
  assert.equal(restarted.checked,0,'new process must honor persisted delay');
  assert.equal(lookups,1);
  await Attempt.updateOne({_id:attempt._id},{$set:{conciliacionReintentoAt:new Date(Date.now()-1000)}});
  const resumed=await makeWorker()({restaurantId:'restart-tenant'});
  assert.equal(resumed.checked,1);
  assert.equal(lookups,2);
  const again=await Attempt.findById(attempt._id).lean();
  assert.equal(again.conciliacionIntentos,2);
  assert.ok(again.conciliacionReintentoAt>saved.conciliacionReintentoAt);
 }finally{
  await conn.dropDatabase();
  await conn.close();
 }
});
