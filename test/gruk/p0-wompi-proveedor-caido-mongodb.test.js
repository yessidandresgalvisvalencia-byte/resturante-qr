'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const mongoose=require('mongoose');
const Intento=require('../../models/IntentoPagoPedido');
const {crearConciliadorWompi}=require('../../services/p0/conciliarPendientesWompi');

test('MongoDB: gateway outage persists retry, then succeeds without losing attempt',{timeout:40000},async t=>{
 if(!process.env.TEST_MONGO_URI){t.skip('Requires TEST_MONGO_URI');return;}
 const conn=mongoose.createConnection(process.env.TEST_MONGO_URI,{dbName:'gruk_p0_gateway_outage_'+process.pid,serverSelectionTimeoutMS:10000});
 await conn.asPromise();
 const Attempt=conn.model(Intento.modelName,Intento.schema);
 const reference='GRUK_PEDIDO_'+new mongoose.Types.ObjectId();
 let online=false,lookups=0,confirmations=0;
 const reconciler=crearConciliadorWompi({
  IntentoModel:Attempt,habilitado:()=>true,
  consultar:async id=>{
   lookups++;
   if(!online)throw new Error('gateway timeout with SECRET_KEY');
   return {id,reference,status:'PENDING',currency:'COP',amount_in_cents:2500000};
  },
  confirmar:async()=>{confirmations++;return {handled:true,ok:true,estado:'PENDIENTE'};}
 });
 const previousError=console.error,logs=[];
 console.error=(...args)=>logs.push(JSON.stringify(args));
 try{
  await Attempt.init();
  const attempt=await Attempt.create({reference,restaurantId:'gateway-outage',pedidoIds:[new mongoose.Types.ObjectId()],
   amountInCents:2500000,currency:'COP',transactionId:'tx-outage',estado:'PENDIENTE'});
  const unavailable=await reconciler({restaurantId:'gateway-outage'});
  assert.equal(unavailable.failed,1);
  assert.equal(confirmations,0);
  const after=await Attempt.findById(attempt._id).lean();
  assert.equal(after.estado,'PENDIENTE');
  assert.equal(after.conciliacionIntentos,1);
  assert.equal(after.conciliacionUltimoError,'CONSULTA_O_CONFIRMACION_ERROR');
  assert.ok(after.conciliacionReintentoAt>new Date());
  assert.equal(JSON.stringify(logs).includes('SECRET_KEY'),false);
  online=true;
  assert.equal((await reconciler({restaurantId:'gateway-outage'})).checked,0);
  assert.equal(lookups,1);
  await Attempt.updateOne({_id:attempt._id},{$set:{conciliacionReintentoAt:new Date(Date.now()-1000)}});
  const recovered=await reconciler({restaurantId:'gateway-outage'});
  assert.equal(recovered.unchanged,1);
  assert.equal(confirmations,1);
  assert.equal(lookups,2);
  assert.equal((await Attempt.findById(attempt._id).lean()).conciliacionIntentos,2);
 }finally{
  console.error=previousError;
  await conn.dropDatabase();
  await conn.close();
 }
});
