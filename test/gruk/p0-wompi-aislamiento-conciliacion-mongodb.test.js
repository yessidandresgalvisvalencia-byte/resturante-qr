'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const mongoose=require('mongoose');
const Intento=require('../../models/IntentoPagoPedido');
const {crearConciliadorWompi}=require('../../services/p0/conciliarPendientesWompi');

test('Wompi reconciler isolates tenants even when transactions are pending in same database',{timeout:40000},async t=>{
 if(!process.env.TEST_MONGO_URI){t.skip('Requires real MongoDB');return;}
 const conn=mongoose.createConnection(process.env.TEST_MONGO_URI,{
  dbName:'gruk_p0_reconciliation_tenant_'+process.pid,serverSelectionTimeoutMS:10000
 });
 await conn.asPromise();
 const Attempt=conn.model(Intento.modelName,Intento.schema);
 const one='tenant-one-'+process.pid,two='tenant-two-'+process.pid;
 const refOne='GRUK_PEDIDO_'+new mongoose.Types.ObjectId();
 const refTwo='GRUK_PEDIDO_'+new mongoose.Types.ObjectId();
 const consulted=[];
 try{
  await Attempt.init();
  await Attempt.create([
   {reference:refOne,restaurantId:one,pedidoIds:[new mongoose.Types.ObjectId()],amountInCents:10000,transactionId:'txn-tenant-a',estado:'PENDIENTE'},
   {reference:refTwo,restaurantId:two,pedidoIds:[new mongoose.Types.ObjectId()],amountInCents:20000,transactionId:'txn-tenant-b',estado:'PENDIENTE'}
  ]);
  const conciliador=crearConciliadorWompi({
   IntentoModel:Attempt,habilitado:({restaurantId})=>restaurantId===one,
   consultar:async id=>{
    consulted.push(id);
    return {id,reference:refOne,amount_in_cents:10000,currency:'COP',status:'PENDING'};
   },
   confirmar:async()=>({handled:true,ok:true,estado:'PENDIENTE'})
  });
  assert.deepEqual(await conciliador({restaurantId:one}),{checked:1,approved:0,unchanged:1,failed:0});
  await assert.rejects(conciliador({restaurantId:two}),/CONCILIACION_P0_NO_HABILITADA/);
  assert.deepEqual(consulted,['txn-tenant-a']);
  assert.equal((await Attempt.findOne({reference:refTwo}).lean()).conciliacionIntentos,0);
  assert.equal((await Attempt.findOne({reference:refTwo}).lean()).conciliacionLeaseUntil,null);
 }finally{
  await conn.dropDatabase();
  await conn.close();
 }
});
