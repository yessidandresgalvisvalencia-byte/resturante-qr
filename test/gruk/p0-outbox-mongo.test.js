'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const mongoose=require('mongoose');
const {randomUUID}=require('node:crypto');
const Outbox=require('../../models/GrukOutbox');

const uri=process.env.TEST_MONGO_URI;
const blocked=process.env.NODE_ENV==='production'||!uri||!/^mongodb:\/\/((127\.0\.0\.1)|(localhost))(?:[:\/?,]|$)/.test(uri);
test('CI exige TEST_MONGO_URI local para la prueba de concurrencia',()=>{
 if(process.env.CI==='true')assert.equal(blocked,false,'CI_NO_TIENE_MONGO_LOCAL_VALIDO');
});
test('Outbox: two competing workers cannot claim the same pending event on a local MongoDB replica set',{skip:blocked?'Requires explicit local TEST_MONGO_URI and nonproduction environment':false,timeout:30000},async()=>{
 const conn=await mongoose.createConnection(uri,{serverSelectionTimeoutMS:5000}).asPromise();
 const Model=conn.model('GrukOutboxP0Test',Outbox.schema,'gruk_outbox_p0_tests');
 // The production publisher is coupled to the default mongoose connection,
 // so this integration test uses a dedicated scoped collection to exercise
 // the atomic claim and fencing predicates directly.
 const empresaId=new mongoose.Types.ObjectId(),aggregateId=new mongoose.Types.ObjectId();
 const eventId='PEDIDO_CREADO:'+randomUUID();
 try{
  await Model.init();
  await Model.create({eventId,empresaId,aggregateId,eventName:'PEDIDO_CREADO',payload:{pedidoId:String(aggregateId)}});
  const claim=async(worker)=>{
   const token=randomUUID(),clock=new Date();
   return Model.findOneAndUpdate({eventId,nextAttemptAt:{$lte:clock},$or:[{status:'PENDING'},{status:'CLAIMED',leaseUntil:{$lte:clock}}]},{$set:{status:'CLAIMED',claimedBy:worker,claimToken:token,leaseUntil:new Date(clock.getTime()+60000)},$inc:{attempts:1}},{new:true});
  };
  const [a,b]=await Promise.all([claim('a'),claim('b')]);
  assert.equal([a,b].filter(Boolean).length,1,'exactly one worker may claim the event');
  const winner=a||b;
  const wrong=await Model.updateOne({_id:winner._id,status:'CLAIMED',claimToken:'stale-token'},{$set:{status:'DONE'}});
  assert.equal(wrong.modifiedCount,0,'stale lease must not acknowledge a current claim');
  const expired=await Model.updateOne({_id:winner._id,status:'CLAIMED',claimToken:winner.claimToken},{$set:{leaseUntil:new Date(Date.now()-1000)}});
  assert.equal(expired.modifiedCount,1);
  const successor=await claim('successor');
  assert.ok(successor,'expired lease must be reclaimable');
  assert.notEqual(successor.claimToken,winner.claimToken);
  const stale=await Model.updateOne({_id:winner._id,status:'CLAIMED',claimToken:winner.claimToken},{$set:{status:'DONE'}});
  assert.equal(stale.modifiedCount,0,'expired owner must not acknowledge re-claimed event');
  const correct=await Model.updateOne({_id:successor._id,status:'CLAIMED',claimedBy:successor.claimedBy,claimToken:successor.claimToken},{$set:{status:'DONE'}});
  assert.equal(correct.modifiedCount,1);
 }finally{
  await Model.deleteOne({eventId});
  await conn.close();
 }
});
