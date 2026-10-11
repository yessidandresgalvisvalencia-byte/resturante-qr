'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const mongoose=require('mongoose');
const Intento=require('../../models/IntentoPagoPedido');
const {crearConciliadorWompi}=require('../../services/p0/conciliarPendientesWompi');

test('MongoDB Wompi reconciler must never claim or query payments belonging to another tenant',{timeout:40000},async t=>{
 if(!process.env.TEST_MONGO_URI){t.skip('Requires TEST_MONGO_URI');return;}
 const conn=mongoose.createConnection(process.env.TEST_MONGO_URI,{
  dbName:'gruk_p0_reconcile_tenant_'+process.pid,serverSelectionTimeoutMS:10000
 });
 await conn.asPromise();
 const Attempt=conn.model(Intento.modelName,Intento.schema);
 let lookupCount=0,settlements=0;
 const conciliar=crearConciliadorWompi({
  IntentoModel:Attempt,habilitado:({restaurantId})=>['tenant-a','tenant-b'].includes(restaurantId),
  consultar:async id=>{lookupCount++;return {id,reference:'GRUK_PEDIDO_A',status:'PENDING',amount_in_cents:10000,currency:'COP'};},
  confirmar:async()=>{settlements++;return {handled:true,ok:true,estado:'PENDIENTE'};}
 });
 try{
  await Attempt.init();
  const attempt=await Attempt.create({reference:'GRUK_PEDIDO_A',restaurantId:'tenant-a',
   pedidoIds:[new mongoose.Types.ObjectId()],amountInCents:10000,currency:'COP',
   transactionId:'txn-a',estado:'PENDIENTE'});
  const wrong=await conciliar({restaurantId:'tenant-b'});
  assert.deepEqual(wrong,{checked:0,approved:0,unchanged:0,failed:0});
  assert.equal(lookupCount,0);
  assert.equal(settlements,0);
  assert.equal((await Attempt.findById(attempt._id).lean()).conciliacionToken,null);
  const right=await conciliar({restaurantId:'tenant-a'});
  assert.equal(right.checked,1);
  assert.equal(right.unchanged,1);
  assert.equal(lookupCount,1);
  assert.equal(settlements,1);
  assert.equal((await Attempt.findById(attempt._id).lean()).estado,'PENDIENTE');
 }finally{
  await conn.dropDatabase();
  await conn.close();
 }
});
