'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const mongoose=require('mongoose');
const Venta=require('../../models/Venta');
const OID=()=>new mongoose.Types.ObjectId();
test('MongoDB replica set prevents duplicate sales under concurrent payment settlements', {timeout:30000}, async t=>{
 const uri=process.env.TEST_MONGO_URI;
 if(!uri){t.skip('Requires a real MongoDB replica set via TEST_MONGO_URI');return;}
 const conn=mongoose.createConnection(uri,{dbName:'gruk_p0_venta_concurrente_'+process.pid,serverSelectionTimeoutMS:10000});
 await conn.asPromise();
 const Sale=conn.model(Venta.modelName,Venta.schema);
 const empresaId=OID(),pedidoId=OID(),productoServicioId=OID();
 const payload={empresaId,origen:'restaurante',origenId:pedidoId,productoServicioId,concepto:'Pedido concurrente',cantidad:1,precioUnitario:15000,total:15000,estado:'pagada'};
 try {
  await Sale.init();
  const attempts=await Promise.allSettled(Array.from({length:2},async()=>{
   const session=await conn.startSession();
   try{
    await session.withTransaction(async()=>{await Sale.create([payload],{session})},{readConcern:{level:'snapshot'},writeConcern:{w:'majority'}});
   }finally{await session.endSession();}
  }));
  const records=await Sale.find({empresaId,origen:'restaurante',origenId:pedidoId}).lean();
  assert.equal(records.length,1,'exactly one durable sale must remain');
  assert.equal(attempts.filter(x=>x.status==='fulfilled').length,1,'only one transaction may insert the unique sale');
  assert.equal(attempts.filter(x=>x.status==='rejected').length,1,'the concurrent duplicate must be rejected');
 }finally{await conn.dropDatabase();await conn.close();}
});
