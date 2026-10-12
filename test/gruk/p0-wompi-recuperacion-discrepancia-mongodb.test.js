'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const mongoose=require('mongoose');
const Intento=require('../../models/IntentoPagoPedido');
const Venta=require('../../models/Venta');
const Outbox=require('../../models/GrukOutbox');
const Ingreso=require('../../models/GrukIngresoConfirmado');
const {crearConciliadorWompi}=require('../../services/p0/conciliarPendientesWompi');

test('MongoDB: economic mismatch retry later accepts correct Wompi response just once',{timeout:45000},async t=>{
 if(!process.env.TEST_MONGO_URI){t.skip('Requires replica set');return;}
 const conn=mongoose.createConnection(process.env.TEST_MONGO_URI,{dbName:'gruk_p0_recovery_correct_'+process.pid,serverSelectionTimeoutMS:10000});
 await conn.asPromise();
 const Attempt=conn.model(Intento.modelName,Intento.schema);
 const Sale=conn.model(Venta.modelName,Venta.schema);
 const Event=conn.model(Outbox.modelName,Outbox.schema);
 const Income=conn.model(Ingreso.modelName,Ingreso.schema);
 const rid='recovery-tenant-'+process.pid,ref='GRUK_PEDIDO_'+new mongoose.Types.ObjectId(),transactionId='tx-recovery-'+process.pid;
 let corrected=false,confirmations=0;
 const reconcile=crearConciliadorWompi({
  IntentoModel:Attempt,habilitado:()=>true,
  consultar:async()=>({id:transactionId,reference:ref,status:'APPROVED',
   currency:'COP',amount_in_cents:corrected?1500000:1499999}),
  confirmar:async({transaction})=>{
   confirmations++;
   const result=await Attempt.updateOne({reference:transaction.reference,estado:{$ne:'APROBADO'}},{$set:{estado:'APROBADO',resueltoAt:new Date()}});
   return {handled:true,ok:true,estado:'APROBADO',idempotent:result.modifiedCount===0};
  }
 });
 try{
  await Promise.all([Attempt.init(),Sale.init(),Event.init(),Income.init()]);
  const attempt=await Attempt.create({restaurantId:rid,reference:ref,pedidoIds:[new mongoose.Types.ObjectId()],
   amountInCents:1500000,currency:'COP',transactionId,estado:'PENDIENTE'});
  const mismatched=await reconcile({restaurantId:rid});
  assert.equal(mismatched.failed,1);assert.equal(confirmations,0);
  assert.equal((await Attempt.findById(attempt._id).lean()).estado,'PENDIENTE');
  corrected=true;
  assert.equal((await reconcile({restaurantId:rid})).checked,0,'persisted retry delay respected');
  await Attempt.updateOne({_id:attempt._id},{$set:{conciliacionReintentoAt:new Date(Date.now()-1000)}});
  const recovered=await reconcile({restaurantId:rid});
  assert.equal(recovered.approved,1);assert.equal(confirmations,1);
  assert.equal((await Attempt.findById(attempt._id).lean()).estado,'APROBADO');
  assert.equal((await reconcile({restaurantId:rid})).checked,0,'approved payment must not be reconciled again');
  assert.equal(confirmations,1);
  assert.equal(await Sale.countDocuments({}),0);
  assert.equal(await Event.countDocuments({}),0);
  assert.equal(await Income.countDocuments({}),0);
 }finally{await conn.dropDatabase();await conn.close();}
});
