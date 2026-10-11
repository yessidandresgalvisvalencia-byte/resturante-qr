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
const {crearConciliadorWompi}=require('../../services/p0/conciliarPendientesWompi');
const {confirmarPagoPedidoWompi}=require('../../services/pagosPedidos.service');
const {publicarLote}=require('../../services/p0/outbox.service');

test('Wompi reconciliation: invalid amount then valid approval -> one ACID sale and income',{timeout:60000},async t=>{
 if(!process.env.TEST_MONGO_URI){t.skip('Requires MongoDB replica set');return;}
 const oldFlag=process.env.GRUK_P0_PEDIDOS_ENABLED,oldAllow=process.env.GRUK_P0_PEDIDOS_RESTAURANTES;
 const rid='p0-full-reconcile-'+process.pid;
 process.env.GRUK_P0_PEDIDOS_ENABLED='true';process.env.GRUK_P0_PEDIDOS_RESTAURANTES=rid;
 await mongoose.connect(process.env.TEST_MONGO_URI,{dbName:'gruk_p0_reconcile_full_'+process.pid,serverSelectionTimeoutMS:10000});
 try{
  await Promise.all([Intento.init(),Venta.init(),Outbox.init(),Ingreso.init()]);
  const empresaId=new mongoose.Types.ObjectId();
  await Restaurante.create({empresaId,restaurantId:rid,nombreRestaurante:'GRUK Test',correo:'reconcile@example.com',usuarioAdmin:rid,passwordAdmin:'hash'});
  const product=await Producto.create({empresaId,tipo:'producto',nombre:'Almuerzo',precioVenta:12000,costoUnitario:4000});
  const pedido=await Pedido.create({restaurantId:rid,mesa:1,productoServicioId:product._id,cantidad:1,precioUnitario:12000,precio:12000,producto:'Almuerzo'});
  const reference='GRUK_PEDIDO_'+pedido._id,txnId='tx-full-'+pedido._id;
  const intento=await Intento.create({reference,restaurantId:rid,pedidoIds:[pedido._id],amountInCents:1200000,transactionId:txnId,estado:'PENDIENTE'});
  let valid=false;
  const reconciler=crearConciliadorWompi({
   habilitado:()=>true,
   consultar:async()=>({id:txnId,reference,status:'APPROVED',currency:'COP',amount_in_cents:valid?1200000:1199999}),
   confirmar:confirmarPagoPedidoWompi
  });
  const first=await reconciler({restaurantId:rid});
  assert.equal(first.failed,1);
  assert.equal(await Venta.countDocuments({origenId:pedido._id}),0);
  assert.equal(await Outbox.countDocuments({empresaId}),0);
  assert.equal((await Pedido.findById(pedido._id).lean()).estadoPago,'pendiente');
  valid=true;
  assert.equal((await reconciler({restaurantId:rid})).checked,0);
  await Intento.updateOne({_id:intento._id},{$set:{conciliacionReintentoAt:new Date(Date.now()-1000)}});
  const recovered=await reconciler({restaurantId:rid});
  assert.equal(recovered.approved,1);
  assert.equal((await Intento.findById(intento._id).lean()).estado,'APROBADO');
  assert.equal((await Pedido.findById(pedido._id).lean()).estadoPago,'pagado');
  const sale=await Venta.findOne({empresaId,origenId:pedido._id}).lean();
  assert.ok(sale);assert.equal(sale.metodoPago,'tarjeta');
  assert.equal(await Venta.countDocuments({origenId:pedido._id}),1);
  assert.equal(await Outbox.countDocuments({empresaId}),2);
  const replay=await reconciler({restaurantId:rid});
  assert.equal(replay.checked,0);
  const io={to(){return {emit(){}}}};
  const batch=await publicarLote({io,workerId:'recovered-approval-test',limit:10});
  assert.equal(batch.failed,0);assert.equal(batch.sent,2);
  assert.equal(await Ingreso.countDocuments({ventaId:sale._id,empresaId}),1);
  const income=await Ingreso.findOne({ventaId:sale._id,empresaId}).lean();
  assert.equal(income.importeCentavos,1200000);
  // Reordered Wompi callbacks after recovery cannot downgrade a settled payment.
  const settledTransaction={id:txnId,reference,status:'APPROVED',amount_in_cents:1200000,currency:'COP'};
  const replayWebhook=await confirmarPagoPedidoWompi({transaction:settledTransaction});
  assert.equal(replayWebhook.ok,true);
  assert.equal(replayWebhook.idempotent,true);
  for(const status of ['PENDING','DECLINED','ERROR']){
   const delayed=await confirmarPagoPedidoWompi({transaction:{...settledTransaction,status}});
   assert.equal(delayed.ok,true);
   assert.equal(delayed.idempotent,true);
  }
  assert.equal((await Intento.findById(intento._id).lean()).estado,'APROBADO');
  assert.equal((await Pedido.findById(pedido._id).lean()).estadoPago,'pagado');
  assert.equal(await Venta.countDocuments({origenId:pedido._id}),1);
  assert.equal(await Outbox.countDocuments({empresaId}),2);
  // Re-delivery of an already completed outbox event must not duplicate income.
  const duplicateDelivery=await publicarLote({io,workerId:'recovered-approval-replay',limit:10});
  assert.equal(duplicateDelivery.sent,0);
  assert.equal(duplicateDelivery.failed,0);
  assert.equal(await Ingreso.countDocuments({ventaId:sale._id,empresaId}),1);
  assert.equal(await Venta.countDocuments({origenId:pedido._id}),1);
 }finally{
  await mongoose.connection.dropDatabase();await mongoose.disconnect();
  if(oldFlag===undefined)delete process.env.GRUK_P0_PEDIDOS_ENABLED;else process.env.GRUK_P0_PEDIDOS_ENABLED=oldFlag;
  if(oldAllow===undefined)delete process.env.GRUK_P0_PEDIDOS_RESTAURANTES;else process.env.GRUK_P0_PEDIDOS_RESTAURANTES=oldAllow;
 }
});
