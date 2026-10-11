'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const mongoose=require('mongoose');
const Intento=require('../../models/IntentoPagoPedido');
const Venta=require('../../models/Venta');
const Outbox=require('../../models/GrukOutbox');
const Ingreso=require('../../models/GrukIngresoConfirmado');
const {crearConciliadorWompi}=require('../../services/p0/conciliarPendientesWompi');

test('MongoDB: Wompi economic mismatch cannot create sale, outbox or confirmed income',{timeout:40000},async t=>{
 if(!process.env.TEST_MONGO_URI){t.skip('Requires TEST_MONGO_URI');return;}
 const conn=mongoose.createConnection(process.env.TEST_MONGO_URI,{dbName:'gruk_p0_economic_mismatch_'+process.pid,serverSelectionTimeoutMS:10000});
 await conn.asPromise();
 const Attempt=conn.model(Intento.modelName,Intento.schema);
 const Sale=conn.model(Venta.modelName,Venta.schema);
 const Event=conn.model(Outbox.modelName,Outbox.schema);
 const Income=conn.model(Ingreso.modelName,Ingreso.schema);
 const rid='economic-tenant-'+process.pid;
 const ref='GRUK_PEDIDO_'+new mongoose.Types.ObjectId();
 const txn='txn-economic-'+process.pid;
 let confirmCalls=0;
 try{
  await Attempt.init();
  const attempt=await Attempt.create({reference:ref,restaurantId:rid,pedidoIds:[new mongoose.Types.ObjectId()],
   amountInCents:1500000,currency:'COP',estado:'PENDIENTE',transactionId:txn});
  const cases=[
   {amount_in_cents:1499999,currency:'COP'},
   {amount_in_cents:1500000,currency:'USD'},
   {amount_in_cents:'1500000',currency:'COP'}
  ];
  for(const mismatch of cases){
   const conciliador=crearConciliadorWompi({IntentoModel:Attempt,habilitado:()=>true,
    consultar:async()=>({id:txn,reference:ref,status:'APPROVED',...mismatch}),
    confirmar:async()=>{confirmCalls++;throw Error('MUST_NOT_CONFIRM');}});
   const outcome=await conciliador({restaurantId:rid});
   assert.equal(outcome.failed,1);
   assert.equal(confirmCalls,0);
   assert.equal((await Attempt.findById(attempt._id).lean()).estado,'PENDIENTE');
   assert.equal(await Sale.countDocuments({}),0);
   assert.equal(await Event.countDocuments({}),0);
   assert.equal(await Income.countDocuments({}),0);
   // Explicitly advance only the retry schedule for each independent invalid response.
   await Attempt.updateOne({_id:attempt._id},{$set:{conciliacionReintentoAt:new Date(Date.now()-1000)}});
  }
 }finally{
  await conn.dropDatabase();
  await conn.close();
 }
});
