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
const {confirmarPagoPedidoWompi}=require('../../services/pagosPedidos.service');

test('real MongoDB: lease takeover during ACID sale forces rollback of sale, order and outbox',{timeout:60000},async t=>{
 if(!process.env.TEST_MONGO_URI){t.skip('Requires MongoDB replica set');return;}
 const oldFlag=process.env.GRUK_P0_PEDIDOS_ENABLED,oldList=process.env.GRUK_P0_PEDIDOS_RESTAURANTES;
 const rid='p0-midtxn-fence-'+process.pid;
 process.env.GRUK_P0_PEDIDOS_ENABLED='true';
 process.env.GRUK_P0_PEDIDOS_RESTAURANTES=rid;
 const originalSave=Pedido.prototype.save;
 let takeoverDone=false;
 await mongoose.connect(process.env.TEST_MONGO_URI,{dbName:'gruk_p0_midtxn_fence_'+process.pid,serverSelectionTimeoutMS:10000});
 try{
  await Promise.all([Venta.init(),Outbox.init(),Intento.init()]);
  const empresaId=new mongoose.Types.ObjectId();
  await Restaurante.create({empresaId,restaurantId:rid,nombreRestaurante:'GRUK Test',correo:'midtxn@example.com',usuarioAdmin:rid,passwordAdmin:'hash'});
  const product=await Producto.create({empresaId,tipo:'producto',nombre:'Almuerzo',precioVenta:12000,costoUnitario:4000});
  const pedido=await Pedido.create({restaurantId:rid,mesa:1,productoServicioId:product._id,cantidad:1,precioUnitario:12000,precio:12000,producto:'Almuerzo'});
  const reference='GRUK_PEDIDO_'+pedido._id;
  const token='original-worker';
  await Intento.create({reference,restaurantId:rid,pedidoIds:[pedido._id],amountInCents:1200000,
   transactionId:'tx-midtxn',estado:'PENDIENTE',conciliacionToken:token,conciliacionLeaseUntil:new Date(Date.now()+60000)});
  Pedido.prototype.save=async function(options){
   if(this.estadoPago==='pagado'&&!takeoverDone){
    takeoverDone=true;
    // Independent connection context: simulate the second instance changing ownership
    // while this first instance has already created an uncommitted Venta.
    const takeover=await Intento.updateOne({reference,conciliacionToken:token},
      {$set:{conciliacionToken:'second-worker',conciliacionLeaseUntil:new Date(Date.now()+60000)}});
    assert.equal(takeover.modifiedCount,1);
   }
   return originalSave.call(this,options);
  };
  const txn={id:'tx-midtxn',reference,status:'APPROVED',amount_in_cents:1200000,currency:'COP'};
  await assert.rejects(confirmarPagoPedidoWompi({transaction:txn,conciliacionToken:token}));
  assert.equal(takeoverDone,true,'takeover must happen during payment transaction');
  assert.equal((await Intento.findOne({reference}).lean()).estado,'PENDIENTE');
  assert.equal((await Pedido.findById(pedido._id).lean()).estadoPago,'pendiente');
  assert.equal(await Venta.countDocuments({empresaId,origenId:pedido._id}),0);
  assert.equal(await Outbox.countDocuments({empresaId}),0);
 }finally{
  Pedido.prototype.save=originalSave;
  await mongoose.connection.dropDatabase();await mongoose.disconnect();
  if(oldFlag===undefined)delete process.env.GRUK_P0_PEDIDOS_ENABLED;else process.env.GRUK_P0_PEDIDOS_ENABLED=oldFlag;
  if(oldList===undefined)delete process.env.GRUK_P0_PEDIDOS_RESTAURANTES;else process.env.GRUK_P0_PEDIDOS_RESTAURANTES=oldList;
 }
});
