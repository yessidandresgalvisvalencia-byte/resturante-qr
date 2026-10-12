'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const mongoose=require('mongoose');
const Intento=require('../../models/IntentoPagoPedido');
const {confirmarPagoPedidoWompi}=require('../../services/pagosPedidos.service');
test('fenced Wompi settlement with expired lease creates no sale or outbox',{timeout:40000},async t=>{
 if(!process.env.TEST_MONGO_URI){t.skip('Requires MongoDB replica set');return;}
 const old=process.env.GRUK_P0_PEDIDOS_ENABLED,oldList=process.env.GRUK_P0_PEDIDOS_RESTAURANTES;
 const rid='p0-expired-fence-'+process.pid;
 process.env.GRUK_P0_PEDIDOS_ENABLED='true';
 process.env.GRUK_P0_PEDIDOS_RESTAURANTES=rid;
 await mongoose.connect(process.env.TEST_MONGO_URI,{dbName:'gruk_p0_expired_fence_'+process.pid,serverSelectionTimeoutMS:10000});
 const reference='GRUK_PEDIDO_'+new mongoose.Types.ObjectId();
 const id=new mongoose.Types.ObjectId();
 try{
  await Intento.create({reference,restaurantId:rid,pedidoIds:[id],amountInCents:1500000,
    transactionId:'tx-expired',estado:'PENDIENTE',conciliacionToken:'owner-1',
    conciliacionLeaseUntil:new Date(Date.now()-1000)});
  const txn={id:'tx-expired',reference,status:'APPROVED',currency:'COP',amount_in_cents:1500000};
  await assert.rejects(confirmarPagoPedidoWompi({transaction:txn,conciliacionToken:'owner-1'}),/CONCILIACION_RESERVA_PERDIDA/);
  const updated=await Intento.findOne({reference}).lean();
  assert.equal(updated.estado,'PENDIENTE');
  assert.equal(updated.transactionId,'tx-expired');
  assert.equal(await mongoose.connection.db.collection('ventas').countDocuments({origenId:id}),0);
  assert.equal(await mongoose.connection.db.collection('grukoutboxes').countDocuments({}),0);
 }finally{
  await mongoose.connection.dropDatabase();await mongoose.disconnect();
  if(old===undefined)delete process.env.GRUK_P0_PEDIDOS_ENABLED;else process.env.GRUK_P0_PEDIDOS_ENABLED=old;
  if(oldList===undefined)delete process.env.GRUK_P0_PEDIDOS_RESTAURANTES;else process.env.GRUK_P0_PEDIDOS_RESTAURANTES=oldList;
 }
});
