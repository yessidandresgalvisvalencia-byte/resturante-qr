'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const mongoose=require('mongoose');
const Outbox=require('../../models/GrukOutbox');
const {registrarEventoEnTransaccion,publicarLote}=require('../../services/p0/outbox.service');

test('two concurrent outbox workers claim one event at most once',{timeout:40000},async t=>{
 if(!process.env.TEST_MONGO_URI){t.skip('Requires real MongoDB replica set');return;}
 const connection=mongoose.createConnection(process.env.TEST_MONGO_URI,{
  dbName:'gruk_p0_outbox_parallel_'+process.pid,serverSelectionTimeoutMS:10000
 });
 await connection.asPromise();
 const Event=connection.model(Outbox.modelName,Outbox.schema);
 const empresaId=new mongoose.Types.ObjectId(),pedidoId=new mongoose.Types.ObjectId();
 const session=await connection.startSession();
  await Event.init();
  // registrarEventoEnTransaccion uses the default Outbox model, so create
  // through this isolated connection while retaining identical schema/indexes.
  await session.withTransaction(async()=>{
   await Event.create([{eventId:'PEDIDO_CREADO:'+String(pedidoId),empresaId,
    eventName:'PEDIDO_CREADO',aggregateId:pedidoId,payload:{pedidoId:String(pedidoId)}}],{session});
  });
  const rooms=[];
  const io={to(room){return {emit(event,data){rooms.push({room,event,id:data.eventId});}}}};
  // The publisher uses the default model. Bind it to the same test database
  // for this isolated integration test.
  const existing=mongoose.connection;
  if(existing.readyState!==0)throw Error('SHARED_MONGOOSE_CONNECTION_IN_USE');
  await mongoose.connect(process.env.TEST_MONGO_URI,{dbName:connection.name,serverSelectionTimeoutMS:10000});
  try{
   const results=await Promise.all([
    publicarLote({io,workerId:'parallel-A',limit:1}),
    publicarLote({io,workerId:'parallel-B',limit:1})
   ]);
   assert.equal(results.reduce((n,r)=>n+r.sent,0),1);
   assert.equal(rooms.length,1);
   assert.equal(rooms[0].room,'empresa-'+String(empresaId));
   assert.equal(await Event.countDocuments({status:'DONE'}),1);
   assert.equal(await Event.countDocuments({status:'CLAIMED'}),0);
  }finally{await session.endSession();await connection.dropDatabase();await connection.close();await mongoose.disconnect();}
});
