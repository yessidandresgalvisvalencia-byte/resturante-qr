'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const mongoose=require('mongoose');
const Pedido=require('../../models/pedido');
const Restaurante=require('../../models/restaurante');
const Producto=require('../../models/ProductoServicio');
const Intento=require('../../models/IntentoPagoPedido');
const Venta=require('../../models/Venta');
const Outbox=require('../../models/GrukOutbox');
const Ingreso=require('../../models/GrukIngresoConfirmado');
const {confirmarPagoPedidoWompi}=require('../../services/pagosPedidos.service');
const {publicarLote}=require('../../services/p0/outbox.service');

test('Wompi P0 end-to-end: approved webhook -> ACID sale -> outbox -> idempotent finance',{timeout:60000},async t=>{
 if(!process.env.TEST_MONGO_URI){t.skip('Requires real MongoDB replica set');return;}
 const oldFlag=process.env.GRUK_P0_PEDIDOS_ENABLED,oldAllow=process.env.GRUK_P0_PEDIDOS_RESTAURANTES;
 const rid='p0-webhook-integration-'+process.pid;
 process.env.GRUK_P0_PEDIDOS_ENABLED='true';
 process.env.GRUK_P0_PEDIDOS_RESTAURANTES=rid;
 await mongoose.connect(process.env.TEST_MONGO_URI,{dbName:'gruk_p0_wompi_full_'+process.pid,serverSelectionTimeoutMS:10000});
 try{
  await Promise.all([Intento.init(),Venta.init(),Outbox.init(),Ingreso.init()]);
  const empresaId=new mongoose.Types.ObjectId();
  await Restaurante.create({empresaId,restaurantId:rid,nombreRestaurante:'Test GRUK',correo:'test@example.com',usuarioAdmin:rid,passwordAdmin:'hash'});
  const producto=await Producto.create({empresaId,tipo:'producto',nombre:'Almuerzo',precioVenta:20000,costoUnitario:8000});
  const pedido=await Pedido.create({restaurantId:rid,mesa:1,productoServicioId:producto._id,cantidad:1,precioUnitario:20000,producto:'Almuerzo',precio:20000});
  const reference='GRUK_PEDIDO_'+String(pedido._id);
  await Intento.create({reference,restaurantId:rid,pedidoIds:[pedido._id],amountInCents:2000000,currency:'COP'});
  const transaction={reference,id:'txn-'+String(pedido._id),status:'APPROVED',amount_in_cents:2000000,currency:'COP'};
  const approval=await confirmarPagoPedidoWompi({transaction});
  assert.equal(approval.ok,true);
  const replay=await confirmarPagoPedidoWompi({transaction});
  assert.equal(replay.idempotent,true);
  const sale=await Venta.findOne({origen:'restaurante',origenId:pedido._id,empresaId}).lean();
  assert.ok(sale);
  assert.equal(sale.metodoPago,'tarjeta');
  assert.equal((await Pedido.findById(pedido._id).lean()).estadoPago,'pagado');
  assert.equal(await Venta.countDocuments({origenId:pedido._id}),1);
  assert.equal(await Outbox.countDocuments({eventId:'VENTA_COMPLETADA:'+String(sale._id)}),1);
  assert.equal(await Outbox.countDocuments({eventId:'PEDIDO_ACTUALIZADO:'+String(pedido._id)+':PAGADO'}),1);
  const events=[];
  const io={to(room){return {emit(name,data){events.push({room,name,id:data.eventId});}}}};
  const published=await publicarLote({io,limit:5,workerId:'full-wompi-test'});
  assert.equal(published.failed,0);
  assert.equal(published.sent,2);
  const ingreso=await Ingreso.findOne({ventaId:sale._id,empresaId}).lean();
  assert.ok(ingreso);
  assert.equal(ingreso.importeCentavos,2000000);
  assert.equal(await Ingreso.countDocuments({ventaId:sale._id}),1);
  assert.equal(events.length,2);
  assert.ok(events.every(e=>e.room==='empresa-'+String(empresaId)));
 }finally{
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  if(oldFlag===undefined)delete process.env.GRUK_P0_PEDIDOS_ENABLED;else process.env.GRUK_P0_PEDIDOS_ENABLED=oldFlag;
  if(oldAllow===undefined)delete process.env.GRUK_P0_PEDIDOS_RESTAURANTES;else process.env.GRUK_P0_PEDIDOS_RESTAURANTES=oldAllow;
 }
});
