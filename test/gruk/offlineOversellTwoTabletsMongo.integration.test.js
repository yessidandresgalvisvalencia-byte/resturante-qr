"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {MongoClient,ObjectId}=require("mongodb");
const {bootstrapOfflineStagingIndexes}=require("../../core/offline/offlineIndexesBootstrap.service");
const {stageAuthorizedOfflineOrders:stage}=require("../../core/offline/offlineAdminStage.service");
const auth={empresaId:"507f191e810c19729de860ea",sedeId:"507f1f77bcf86cd799439012",
 usuarioId:"operator",rol:"ADMIN_SEDE"};
const productId="507f1f77bcf86cd799439011";
const ids=["01ARZ3NDEKTSV4RRFFQ69G5FA0","01ARZ3NDEKTSV4RRFFQ69G5FA1"];
const oid=x=>new ObjectId(x);
test("real Mongo: two disconnected tablets sell last unit; second is audited without double posting",{timeout:60000},async t=>{
 const uri=process.env.GRUK_TEST_MONGO_URI;
 if(!uri){t.skip("Isolated Mongo replica set required");return;}
 if(!uri.includes("gruk_offline_test"))throw Error("OFFLINE_TEST_DB_NAME_REQUIRED");
 const client=new MongoClient(uri,{serverSelectionTimeoutMS:5000});
 await client.connect();
 const db=client.db("gruk_offline_oversell_two_tablets_test");
 const scoped={client,collection:name=>db.collection(name)};
 const stockKey={empresaId:oid(auth.empresaId),sedeId:oid(auth.sedeId),
  productoServicioId:oid(productId),anulado:false};
 try{
  await db.dropDatabase();
  await bootstrapOfflineStagingIndexes(db);
  await db.collection("productoservicios").insertOne({
   _id:oid(productId),empresaId:oid(auth.empresaId),sedeId:oid(auth.sedeId),
   activo:true,precioVenta:3000
  });
  await db.collection("inventarios").insertOne({...stockKey,cantidad:1});
  await db.collection("gruk_offline_inbox").insertMany(ids.map((eventId,i)=>({
   empresaId:auth.empresaId,sedeId:auth.sedeId,actorId:auth.usuarioId,
   deviceId:"tablet"+(i+1),eventId,status:"PENDIENTE",tipo:"PEDIDO_REGISTRADO",
   payload:{localOrderId:eventId,items:[{productoId:productId,cantidad:"1",
    precioUnitarioCop:"3000",totalCop:"3000"}],totalCop:"3000"}
  })));
  const first=await stage({db:scoped,auth,eventIds:[ids[0]],confirmed:true});
  assert.equal(first.status,"PENDIENTE_CONTABILIZACION");
  assert.equal((await db.collection("inventarios").findOne(stockKey)).cantidad,0);
  const second=await stage({db:scoped,auth,eventIds:[ids[1]],confirmed:true});
  assert.equal(second.status,"REQUIERE_REVISION_STOCK");
  assert.equal(second.applied,false);assert.equal(second.cobrado,false);
  assert.deepEqual(second.issues,[{
   productoId:productId,disponible:"0",solicitado:"1",faltante:"1"
  }]);
  assert.equal((await db.collection("inventarios").findOne(stockKey)).cantidad,0);
  assert.equal(await db.collection("gruk_offline_stock_conflicts").countDocuments({}),1);
  assert.equal(await db.collection("gruk_offline_ventas").countDocuments({}),1);
  assert.equal(await db.collection("gruk_offline_caja_intenciones").countDocuments({}),1);
  assert.equal(await db.collection("gruk_ledger_movimientos").countDocuments({}),1);
  assert.equal(await db.collection("gruk_offline_inbox").countDocuments({eventId:ids[1],status:"PENDIENTE"}),1);
  const again=await stage({db:scoped,auth,eventIds:[ids[1]],confirmed:true});
  assert.equal(again.conflictId,second.conflictId);
  assert.equal(await db.collection("gruk_offline_stock_conflicts").countDocuments({}),1);
  assert.equal((await db.collection("inventarios").findOne(stockKey)).cantidad,0);
  assert.equal(await db.collection("gruk_offline_ventas").countDocuments({}),1);
 }finally{await db.dropDatabase();await client.close();}
});
