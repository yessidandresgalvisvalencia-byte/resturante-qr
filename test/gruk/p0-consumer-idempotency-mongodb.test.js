'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const mongoose=require('mongoose');
const ReceiptModel=require('../../models/GrukEventoConsumido');
const {crearProcesadorIdempotente}=require('../../services/p0/procesadorEventosIdempotente');
test('consumer transaction guarantees one business effect for concurrent duplicate event',{timeout:40000},async t=>{
 if(!process.env.TEST_MONGO_URI){t.skip('Requires MongoDB replica set');return;}
 const dbName='gruk_p0_consumer_'+process.pid;
 const conn=mongoose.createConnection(process.env.TEST_MONGO_URI,{dbName,serverSelectionTimeoutMS:10000});
 await conn.asPromise();
 const Receipt=conn.model(ReceiptModel.modelName,ReceiptModel.schema);
 const Counter=conn.model('ConsumerTestCounter',new mongoose.Schema({empresaId:mongoose.Schema.Types.ObjectId,value:Number},{collection:'gruk_consumer_test_counter'}));
 const empresaId=new mongoose.Types.ObjectId(),eventId='VENTA_COMPLETADA:'+String(new mongoose.Types.ObjectId());
 const processor=crearProcesadorIdempotente({Receipt,mongooseInstance:{isValidObjectId:mongoose.isValidObjectId,startSession:()=>conn.startSession()}});
 const args={empresaId,consumidor:'finanzas',eventId,aplicar:async({session})=>{
  await Counter.updateOne({empresaId},{$inc:{value:1}},{upsert:true,session});
 }};
 try{
  await Receipt.init();
  await Counter.init();
  const concurrent=await Promise.allSettled([processor(args),processor(args)]);
  // Transient write conflicts may require caller retry. Both outcomes must never create two effects.
  for(const result of concurrent){
   if(result.status==='rejected'){
    assert.ok(result.reason,'write conflicts must remain observable');
    await processor(args);
   }
  }
  assert.equal(await Counter.countDocuments({empresaId}),1);
  assert.equal((await Counter.findOne({empresaId}).lean()).value,1);
  assert.equal(await Receipt.countDocuments({empresaId,consumidor:'finanzas',eventId}),1);
  const repeat=await processor(args);
  assert.deepEqual(repeat,{applied:false,replayed:true});
 }finally{await conn.dropDatabase();await conn.close();}
});
test('failed business effect rolls back consumed receipt',{timeout:30000},async t=>{
 if(!process.env.TEST_MONGO_URI){t.skip('Requires MongoDB replica set');return;}
 const conn=mongoose.createConnection(process.env.TEST_MONGO_URI,{dbName:'gruk_p0_consumer_rollback_'+process.pid,serverSelectionTimeoutMS:10000});
 await conn.asPromise();
 const Receipt=conn.model(ReceiptModel.modelName,ReceiptModel.schema);
 const empresaId=new mongoose.Types.ObjectId(),eventId='VENTA_COMPLETADA:'+String(new mongoose.Types.ObjectId());
 const processor=crearProcesadorIdempotente({Receipt,mongooseInstance:{isValidObjectId:mongoose.isValidObjectId,startSession:()=>conn.startSession()}});
 try{
  await Receipt.init();
  await assert.rejects(processor({empresaId,consumidor:'finanzas',eventId,aplicar:async()=>{throw Error('ROLLBACK_EFFECT');}}),/ROLLBACK_EFFECT/);
  assert.equal(await Receipt.countDocuments({empresaId,eventId}),0);
 }finally{await conn.dropDatabase();await conn.close();}
});
