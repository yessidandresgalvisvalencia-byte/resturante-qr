'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const mongoose=require('mongoose');
const Outbox=require('../../models/GrukOutbox');
const {registrarEventoEnTransaccion,publicarLote}=require('../../services/p0/outbox.service');

test('real MongoDB outbox: rollback, failed dispatch retry, tenant room and durable ACK',{timeout:40000},async t=>{
 const uri=process.env.TEST_MONGO_URI;
 if(!uri){t.skip('Requires TEST_MONGO_URI with replica set');return;}
 await mongoose.connect(uri,{dbName:'gruk_p0_outbox_delivery_'+process.pid,serverSelectionTimeoutMS:10000});
 const empresaId=new mongoose.Types.ObjectId(),pedidoId=new mongoose.Types.ObjectId();
 const event={eventId:'PEDIDO_CREADO:'+String(pedidoId),empresaId,sedeId:null,eventName:'PEDIDO_CREADO',aggregateId:pedidoId,payload:{pedidoId:String(pedidoId),restaurantId:'test'}};
 try {
  await Outbox.init();
  const aborted=await mongoose.startSession();
  try {
   await assert.rejects(aborted.withTransaction(async()=>{
    await registrarEventoEnTransaccion(event,aborted);
    throw Error('SIMULATED_ROLLBACK');
   }),/SIMULATED_ROLLBACK/);
  }finally{await aborted.endSession();}
  assert.equal(await Outbox.countDocuments({eventId:event.eventId}),0,'rollback must discard pending event');

  const session=await mongoose.startSession();
  try {await session.withTransaction(async()=>{await registrarEventoEnTransaccion(event,session);});}
  finally{await session.endSession();}
  assert.equal(await Outbox.countDocuments({eventId:event.eventId,status:'PENDING'}),1);

  const failing={to(){return {emit(){throw Error('SOCKET_DOWN');}}}};
  const first=await publicarLote({io:failing,limit:1,workerId:'failure-worker'});
  assert.equal(first.failed,1);
  let stored=await Outbox.findOne({eventId:event.eventId}).lean();
  assert.equal(stored.status,'PENDING');
  assert.match(stored.lastError,/SOCKET_DOWN/);

  await Outbox.updateOne({_id:stored._id},{$set:{nextAttemptAt:new Date(0)}});
  const delivered=[];
  const success={to(room){return {emit(name,data){delivered.push({room,name,data});}}}};
  const second=await publicarLote({io:success,limit:1,workerId:'recovery-worker'});
  assert.equal(second.sent,1);
  assert.equal(delivered.length,1);
  assert.equal(delivered[0].room,'empresa-'+String(empresaId));
  assert.equal(delivered[0].data.eventId,event.eventId);
  stored=await Outbox.findOne({eventId:event.eventId}).lean();
  assert.equal(stored.status,'DONE');
  assert.ok(stored.dispatchedAt);
  assert.equal(await Outbox.countDocuments({eventId:event.eventId}),1);
  const repeat=await publicarLote({io:success,limit:1,workerId:'recovery-worker'});
  assert.equal(repeat.sent,0);
  assert.equal(delivered.length,1);
 }finally{await mongoose.connection.dropDatabase();await mongoose.disconnect();}
});
