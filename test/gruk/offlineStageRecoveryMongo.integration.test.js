"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {MongoClient,ObjectId}=require("mongodb");
const {bootstrapOfflineStagingIndexes}=require("../../core/offline/offlineIndexesBootstrap.service");
const {stageAuthorizedOfflineOrders}=require("../../core/offline/offlineAdminStage.service");
const auth={empresaId:"507f191e810c19729de860ea",sedeId:"507f1f77bcf86cd799439012",
 usuarioId:"adminA",rol:"ADMIN_SEDE"};
const productId="507f1f77bcf86cd799439011";
const ids=["01ARZ3NDEKTSV4RRFFQ69G5FA0","01ARZ3NDEKTSV4RRFFQ69G5FA1"];
const objectId=value=>new ObjectId(value);
test("real Mongo: operator retries staged batch without second stock decrement or charge",{timeout:60000},async t=>{
 const uri=process.env.GRUK_TEST_MONGO_URI;
 if(!uri){t.skip("Isolated GRUK_TEST_MONGO_URI required");return;}
 if(!uri.includes("gruk_offline_test"))throw Error("OFFLINE_TEST_DB_NAME_REQUIRED");
 const client=new MongoClient(uri,{serverSelectionTimeoutMS:5000});
 await client.connect();
 const db=client.db("gruk_offline_stage_replay_test");
 const scoped={client,collection:name=>db.collection(name)};
 const inventoryKey={empresaId:objectId(auth.empresaId),sedeId:objectId(auth.sedeId),
  productoServicioId:objectId(productId)};
 const args={db:scoped,auth,eventIds:ids,confirmed:true};
 try{
  await db.dropDatabase();
  await bootstrapOfflineStagingIndexes(db);
  await db.collection("productoservicios").insertOne({
   _id:objectId(productId),empresaId:objectId(auth.empresaId),sedeId:objectId(auth.sedeId),
   activo:true,precioVenta:3000
  });
  await db.collection("inventarios").insertOne({...inventoryKey,cantidad:5,anulado:false});
  await db.collection("gruk_offline_inbox").insertMany(ids.map((eventId,i)=>({
   empresaId:auth.empresaId,sedeId:auth.sedeId,actorId:auth.usuarioId,
   eventId,status:"PENDIENTE",tipo:"PEDIDO_REGISTRADO",payload:{
    localOrderId:eventId,items:[{productoId:productId,cantidad:String(i+1),
     precioUnitarioCop:"3000",totalCop:String((i+1)*3000)}],totalCop:String((i+1)*3000)
   }
  })));
  const first=await stageAuthorizedOfflineOrders(args);
  assert.equal(first.status,"PENDIENTE_CONTABILIZACION");
  assert.equal(first.applied,false);assert.equal(first.cobrado,false);
  assert.equal(first.totalCop,"9000");
  assert.equal((await db.collection("inventarios").findOne(inventoryKey)).cantidad,2);
  const second=await stageAuthorizedOfflineOrders(args);
  assert.equal(second.alreadyStaged,true);
  assert.equal(second.status,"PENDIENTE_CONTABILIZACION");
  assert.equal(second.applied,false);assert.equal(second.cobrado,false);
  assert.equal(second.totalCop,"9000");
  assert.equal((await db.collection("inventarios").findOne(inventoryKey)).cantidad,2);
  assert.equal(await db.collection("gruk_offline_inbox").countDocuments({
   empresaId:auth.empresaId,sedeId:auth.sedeId,status:"EN_REVISION",inventoryApplied:true
  }),2);
  assert.equal(await db.collection("gruk_offline_ventas").countDocuments({}),2);
  assert.equal(await db.collection("gruk_offline_caja_intenciones").countDocuments({cobrado:true}),0);
  assert.equal(await db.collection("gruk_ledger_movimientos").countDocuments({}),2);
 }finally{await db.dropDatabase();await client.close();}
});
