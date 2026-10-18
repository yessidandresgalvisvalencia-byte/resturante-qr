"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const mongoose=require("mongoose");
const {bootstrapOfflineStagingIndexes}=require("../../core/offline/offlineIndexesBootstrap.service");
const {stageOfflineFinancialBatch}=require("../../core/offline/offlineFinancialStaging.service");
const context={empresaId:"empresa",sedeId:"sede",actorId:"cajero"};
const product="507f1f77bcf86cd799439011";
const eventId="01ARZ3NDEKTSV4RRFFQ69G5FA0";
const plan={orders:[{eventId,localOrderId:eventId,totalCop:"3000",items:[{productoId:product,cantidad:"1",precioUnitarioCop:"3000",totalCop:"3000"}]}],totalCop:"3000"};
const inventoryDeltas=[{productoId:product,deltaUnidades:"-1"}];
const ledgerMovements=[{eventId,tipo:"VENTA_OFFLINE",montoCop:"3000"}];
const collections=["gruk_offline_ventas","gruk_offline_stock_movimientos","gruk_offline_caja_intenciones","gruk_ledger_movimientos"];
test("Mongo replica set: atomic commit and rollback across offline staging collections", {timeout:30000},async t=>{
 const uri=process.env.GRUK_TEST_MONGO_URI;
 if(!uri){t.skip("GRUK_TEST_MONGO_URI no configurado");return;}
 // Dedicated disposable test database only. Never connect using production MONGO_URI.
 if(!uri.includes("gruk_offline_test"))throw Error("OFFLINE_TEST_DB_NAME_REQUIRED");
 const client=new mongoose.mongo.MongoClient(uri,{serverSelectionTimeoutMS:5000});
 await client.connect();
 const db=client.db("gruk_offline_test");
 try{
  await db.dropDatabase();
  await bootstrapOfflineStagingIndexes(db);
  // Driver Db does not expose client.startSession; session comes from MongoClient.
  let session=client.startSession();
  try{
   await session.withTransaction(async()=>{
    const out=await stageOfflineFinancialBatch({db,session,context,plan,inventoryDeltas,ledgerMovements});
    assert.equal(out.sales.totalCop,"3000");
    assert.equal(out.cash.totalCop,"3000");
   });
  }finally{await session.endSession();}
  for(const name of collections)assert.equal(await db.collection(name).countDocuments({}),1,name);
  // Remove only disposable fixtures to isolate rollback check.
  for(const name of collections)await db.collection(name).deleteMany({});
  // Seed a conflicting ledger record OUTSIDE transaction. Ledger is immutable.
  await db.collection("gruk_ledger_movimientos").insertOne({
   ...context,eventId,tipo:"VENTA_OFFLINE",montoCop:"9999",deletedAt:null,createdAt:new Date()
  });
  session=client.startSession();
  try{
   await assert.rejects(session.withTransaction(()=>stageOfflineFinancialBatch({
    db,session,context,plan,inventoryDeltas,ledgerMovements
   })),e=>e.code==="OFFLINE_LEDGER_REPLAY_CONFLICT");
  }finally{await session.endSession();}
  for(const name of collections.slice(0,3))
   assert.equal(await db.collection(name).countDocuments({}),0,name+" must rollback");
  assert.equal(await db.collection("gruk_ledger_movimientos").countDocuments({}),1);
 }finally{
  await db.dropDatabase();
  await client.close();
 }
});
