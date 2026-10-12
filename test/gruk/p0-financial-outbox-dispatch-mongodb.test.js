'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const mongoose=require('mongoose');
const Outbox=require('../../models/GrukOutbox');
const {publicarLote}=require('../../services/p0/outbox.service');

test('financial outbox only ACKs after successful projection and retries once on failure',{timeout:40000},async t=>{
 if(!process.env.TEST_MONGO_URI){t.skip('Requires real MongoDB replica set');return;}
 const db='gruk_p0_financial_dispatch_'+process.pid;
 await mongoose.connect(process.env.TEST_MONGO_URI,{dbName:db,serverSelectionTimeoutMS:10000});
 const empresaId=new mongoose.Types.ObjectId(),ventaId=new mongoose.Types.ObjectId();
 const id='VENTA_COMPLETADA:'+String(ventaId);
 const delivered=[],projected=[];
 const io={to(room){return {emit(name,data){delivered.push({room,name,id:data.eventId});}}}};
 try{
  await Outbox.init();
  await Outbox.create({eventId:id,empresaId,eventName:'VENTA_COMPLETADA',aggregateId:ventaId,payload:{ventaId:String(ventaId),restaurantId:'p0',total:25000}});
  const first=await publicarLote({io,workerId:'finance-1',limit:1,proyectarIngreso:async()=>{throw Error('FINANCE_TEMPORARILY_DOWN');}});
  assert.equal(first.failed,1);
  assert.equal(delivered.length,0,'no Socket emit before financial projection');
  let record=await Outbox.findOne({eventId:id}).lean();
  assert.equal(record.status,'PENDING');
  await Outbox.updateOne({_id:record._id},{$set:{nextAttemptAt:new Date(0)}});
  const second=await publicarLote({io,workerId:'finance-2',limit:1,proyectarIngreso:async e=>projected.push(e.eventId)});
  assert.equal(second.sent,1);
  assert.deepEqual(projected,[id]);
  assert.equal(delivered.length,1);
  assert.equal(delivered[0].room,'empresa-'+String(empresaId));
  record=await Outbox.findOne({eventId:id}).lean();
  assert.equal(record.status,'DONE');
  const third=await publicarLote({io,workerId:'finance-3',limit:1,proyectarIngreso:async e=>projected.push(e.eventId)});
  assert.equal(third.sent,0);
  assert.equal(projected.length,1);
 }finally{await mongoose.connection.dropDatabase();await mongoose.disconnect();}
});
