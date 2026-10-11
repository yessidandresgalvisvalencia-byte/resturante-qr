'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const mongoose=require('mongoose');
const Intento=require('../../models/IntentoPagoPedido');
const {crearConciliadorWompi}=require('../../services/p0/conciliarPendientesWompi');
test('MongoDB reconciliation lease: competing workers and expired lease recovery',{timeout:40000},async t=>{
 if(!process.env.TEST_MONGO_URI){t.skip('Requires TEST_MONGO_URI with replica set');return;}
 const conn=mongoose.createConnection(process.env.TEST_MONGO_URI,{dbName:'gruk_p0_reconciliation_lease_'+process.pid,serverSelectionTimeoutMS:10000});
 await conn.asPromise();
 const Attempt=conn.model(Intento.modelName,Intento.schema);
 const reference='GRUK_PEDIDO_'+new mongoose.Types.ObjectId();
 let requests=0,completeFirst;
 const firstGate=new Promise(resolve=>{completeFirst=resolve;});
 const reconciler=crearConciliadorWompi({
  IntentoModel:Attempt,
  habilitado:()=>true,
  consultar:async id=>{requests++;await firstGate;return {id,reference,status:'PENDING',amount_in_cents:10000,currency:'COP'};},
  confirmar:async()=>({handled:true,ok:true,estado:'PENDIENTE'})
 });
 try{
  await Attempt.init();
  const attempt=await Attempt.create({reference,restaurantId:'tenant-test',pedidoIds:[new mongoose.Types.ObjectId()],amountInCents:10000,transactionId:'txn-test',estado:'PENDIENTE'});
  const first=reconciler({restaurantId:'tenant-test'});
  for(let i=0;i<50&&requests===0;i++)await new Promise(resolve=>setTimeout(resolve,20));
  assert.equal(requests,1,'first reconciler must hold the lease before the second starts');
  const second=await reconciler({restaurantId:'tenant-test'});
  assert.equal(second.checked,0,'second reconciler must not claim an active lease');
  assert.equal(requests,1,'only one provider lookup while lease is active');
  completeFirst();
  const firstResult=await first;
  assert.equal(firstResult.unchanged,1);
  const released=await Attempt.findById(attempt._id).lean();
  assert.equal(released.conciliacionToken,null);
  assert.equal(released.conciliacionLeaseUntil,null);
  const old=new Date(Date.now()-10000);
  await Attempt.updateOne({_id:attempt._id},{$set:{conciliacionToken:'crashed-worker',conciliacionLeaseUntil:old}});
  const recovered=await reconciler({restaurantId:'tenant-test'});
  assert.equal(recovered.checked,1,'expired lease must be claimable by a new reconciler');
  assert.equal(requests,2);
  assert.equal((await Attempt.findById(attempt._id).lean()).conciliacionToken,null);
 }finally{
  completeFirst();
  await conn.dropDatabase();
  await conn.close();
 }
});
