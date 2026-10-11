'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const mongoose=require('mongoose');
const Intento=require('../../models/IntentoPagoPedido');
const {crearConciliadorWompi}=require('../../services/p0/conciliarPendientesWompi');

test('real MongoDB: failed reconciliation audit write leaves recoverable lease and no duplicate settlement',{timeout:40000},async t=>{
 if(!process.env.TEST_MONGO_URI){t.skip('Requires TEST_MONGO_URI');return;}
 const conn=mongoose.createConnection(process.env.TEST_MONGO_URI,{
  dbName:'gruk_p0_audit_recovery_'+process.pid,serverSelectionTimeoutMS:10000
 });
 await conn.asPromise();
 const Base=conn.model(Intento.modelName,Intento.schema);
 let failOnce=true,confirmed=0;
 const Model={
  find:q=>Base.find(q),
  findOneAndUpdate:(...args)=>Base.findOneAndUpdate(...args),
  findOne:q=>Base.findOne(q),
  async updateOne(...args){
   if(failOnce){failOnce=false;throw new Error('simulated audit write failure');}
   return Base.updateOne(...args);
  }
 };
 const reference='GRUK_PEDIDO_'+new mongoose.Types.ObjectId();
 const worker=crearConciliadorWompi({
  IntentoModel:Model,habilitado:()=>true,
  consultar:async()=>({id:'tx-audit-recovery',reference,status:'APPROVED',amount_in_cents:10000,currency:'COP'}),
  confirmar:async()=>{
   confirmed++;
   const result=await Base.updateOne({reference,estado:{$ne:'APROBADO'}},{$set:{estado:'APROBADO'}});
   return {handled:true,ok:true,estado:'APROBADO',idempotent:result.modifiedCount===0};
  }
 });
 const originalLog=console.error;console.error=()=>{};
 try{
  await Base.init();
  const attempt=await Base.create({reference,restaurantId:'audit-tenant',pedidoIds:[new mongoose.Types.ObjectId()],
   amountInCents:10000,transactionId:'tx-audit-recovery',estado:'PENDIENTE'});
  const first=await worker({restaurantId:'audit-tenant'});
  assert.equal(first.approved,1);
  assert.equal(first.failed,1,'failed audit write must be observable');
  const after=await Base.findById(attempt._id).lean();
  assert.equal(after.estado,'APROBADO','confirmed state must not be reversed by audit failure');
  assert.ok(after.conciliacionLeaseUntil>new Date(),'failed cleanup leaves recoverable lease');
  await Base.updateOne({_id:attempt._id},{$set:{conciliacionLeaseUntil:new Date(Date.now()-1000)}});
  const next=await worker({restaurantId:'audit-tenant'});
  assert.equal(next.checked,0,'approved attempt must never be reconciled again');
  assert.equal(confirmed,1,'no second financial confirmation');
 }finally{
  console.error=originalLog;
  await conn.dropDatabase();await conn.close();
 }
});
