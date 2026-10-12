'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const mongoose=require('mongoose');
const Venta=require('../../models/Venta');
const Ingreso=require('../../models/GrukIngresoConfirmado');
const Recibo=require('../../models/GrukEventoConsumido');
const {crearProcesadorIdempotente}=require('../../services/p0/procesadorEventosIdempotente');
const {crearProyectorIngresoWompi}=require('../../services/p0/proyectarIngresoWompi');

test('Wompi financial projection applies a paid sale once, even on repeated events',{timeout:40000},async t=>{
 if(!process.env.TEST_MONGO_URI){t.skip('Needs MongoDB replica set');return;}
 const conn=mongoose.createConnection(process.env.TEST_MONGO_URI,{dbName:'gruk_p0_income_'+process.pid,serverSelectionTimeoutMS:10000});
 await conn.asPromise();
 const Sales=conn.model(Venta.modelName,Venta.schema),Receipts=conn.model(Recibo.modelName,Recibo.schema),Income=conn.model(Ingreso.modelName,Ingreso.schema);
 const empresaId=new mongoose.Types.ObjectId();
 const processor=crearProcesadorIdempotente({Receipt:Receipts,mongooseInstance:{isValidObjectId:mongoose.isValidObjectId,startSession:()=>conn.startSession()}});
 const project=crearProyectorIngresoWompi({VentaModel:Sales,IngresoModel:Income,procesar:processor});
 try{
  await Promise.all([Sales.init(),Receipts.init(),Income.init()]);
  const sale=await Sales.create({empresaId,concepto:'Pedido',precioUnitario:30000,total:30000,cantidad:1,metodoPago:'tarjeta',estado:'pagada',metadata:{restaurantId:'test-restaurant'}});
  const evt={empresaId,eventName:'VENTA_COMPLETADA',eventId:'VENTA_COMPLETADA:'+String(sale._id),aggregateId:sale._id,payload:{ventaId:String(sale._id),restaurantId:'test-restaurant',total:30000}};
  const first=await project(evt);assert.equal(first.applied,true);
  const replay=await project(evt);assert.deepEqual(replay,{applied:false,replayed:true});
  assert.equal(await Income.countDocuments({empresaId,ventaId:sale._id}),1);
  assert.equal((await Income.findOne({empresaId,ventaId:sale._id}).lean()).importeCentavos,3000000);
  assert.equal(await Receipts.countDocuments({empresaId,eventId:evt.eventId}),1);
 }finally{await conn.dropDatabase();await conn.close();}
});
test('unverified sale fails and consumes no event',{timeout:40000},async t=>{
 if(!process.env.TEST_MONGO_URI){t.skip('Needs MongoDB replica set');return;}
 const conn=mongoose.createConnection(process.env.TEST_MONGO_URI,{dbName:'gruk_p0_income_reject_'+process.pid,serverSelectionTimeoutMS:10000});await conn.asPromise();
 const Sales=conn.model(Venta.modelName,Venta.schema),Receipts=conn.model(Recibo.modelName,Recibo.schema),Income=conn.model(Ingreso.modelName,Ingreso.schema);
 const empresaId=new mongoose.Types.ObjectId(),saleId=new mongoose.Types.ObjectId();
 const processor=crearProcesadorIdempotente({Receipt:Receipts,mongooseInstance:{isValidObjectId:mongoose.isValidObjectId,startSession:()=>conn.startSession()}});
 const project=crearProyectorIngresoWompi({VentaModel:Sales,IngresoModel:Income,procesar:processor});
 try{
  await Promise.all([Sales.init(),Receipts.init(),Income.init()]);
  const evt={empresaId,eventName:'VENTA_COMPLETADA',eventId:'VENTA_COMPLETADA:'+String(saleId),aggregateId:saleId,payload:{ventaId:String(saleId),restaurantId:'test-restaurant',total:30000}};
  await assert.rejects(project(evt),/INGRESO_VENTA_NO_AUTORIZADA/);
  assert.equal(await Income.countDocuments({}),0);
  assert.equal(await Receipts.countDocuments({}),0);
 }finally{await conn.dropDatabase();await conn.close();}
});
