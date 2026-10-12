'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const mongoose=require('mongoose');
const {randomUUID}=require('node:crypto');
const uri=process.env.TEST_MONGO_URI;
const allowed=process.env.NODE_ENV!=='production'&&typeof uri==='string'&&/^mongodb:\/\/(?:127\.0\.0\.1|localhost)(?:[:\/?,]|$)/.test(uri);
test('CI requires a valid local MongoDB replica set for ACID verification',()=>{
 if(process.env.CI==='true')assert.equal(allowed,true,'CI_P0_MONGO_LOCAL_REQUERIDO');
});
test('P0 MongoDB replica set: rollback atomico de pedido, recibo y outbox',{skip:!allowed?'TEST_MONGO_URI local requerido':false,timeout:30000},async()=>{
 const connection=await mongoose.createConnection(uri,{serverSelectionTimeoutMS:5000}).asPromise();
 const suffix=randomUUID().replace(/-/g,'');
 const Schema=new mongoose.Schema({key:{type:String,required:true,unique:true},kind:{type:String,required:true}},{strict:true});
 const Model=connection.model('P0Tx'+suffix,Schema,'gruk_p0_tx_test_'+suffix);
 const id='p0-'+suffix;
 let session;
 try{
  await Model.init();
  session=await connection.startSession();
  await assert.rejects(session.withTransaction(async()=>{
   await Model.create([{key:id+'-pedido',kind:'pedido'}],{session});
   await Model.create([{key:id+'-recibo',kind:'recibo'}],{session});
   await Model.create([{key:id+'-outbox',kind:'outbox'}],{session});
   throw new Error('FALLO_SIMULADO_OUTBOX');
  },{readConcern:{level:'snapshot'},writeConcern:{w:'majority'}}),/FALLO_SIMULADO_OUTBOX/);
  assert.equal(await Model.countDocuments({key:{$in:[id+'-pedido',id+'-recibo',id+'-outbox']}}),0,'rollback debe revertir todas las escrituras');
  await session.withTransaction(async()=>{
   await Model.create([{key:id+'-pedido',kind:'pedido'}],{session});
   await Model.create([{key:id+'-recibo',kind:'recibo'}],{session});
   await Model.create([{key:id+'-outbox',kind:'outbox'}],{session});
  },{readConcern:{level:'snapshot'},writeConcern:{w:'majority'}});
  assert.equal(await Model.countDocuments({key:{$in:[id+'-pedido',id+'-recibo',id+'-outbox']}}),3,'commit persiste todas las escrituras');
 }finally{
  if(session)await session.endSession();
  await connection.dropCollection(Model.collection.collectionName).catch(()=>{});
  await connection.close();
 }
});
