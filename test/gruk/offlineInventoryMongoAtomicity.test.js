"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const mongoose=require("mongoose");
const {applyOfflineLegacyInventory}=require("../../core/offline/offlineLegacyInventoryWriter.service");
const {ObjectId,MongoClient}=mongoose.mongo;
const empresaId="507f191e810c19729de860ea",sedeId="507f1f77bcf86cd799439012",productoId="507f1f77bcf86cd799439011";
const context={empresaId,sedeId,actorId:"cajero"};
const inventoryDeltas=[{productoId,deltaUnidades:"-2"}];
test("Mongo replica set: inventory decrement commits and rolls back with journal", {timeout:30000},async t=>{
 const uri=process.env.GRUK_TEST_MONGO_URI;
 if(!uri){t.skip("GRUK_TEST_MONGO_URI no configurado");return;}
 if(!uri.includes("gruk_offline_test"))throw Error("OFFLINE_TEST_DB_NAME_REQUIRED");
 const client=new MongoClient(uri,{serverSelectionTimeoutMS:5000});
 const db=client.db("gruk_inventory_atomicity_test");
 await client.connect();
 const id=new ObjectId(productoId);
 try{
  await db.collection("inventarios").insertOne({
   empresaId:new ObjectId(empresaId),sedeId:new ObjectId(sedeId),
   productoServicioId:id,cantidad:5,anulado:false
  });
  let session=client.startSession();
  try{
   await session.withTransaction(async()=>{
    const updates=await applyOfflineLegacyInventory({
     db,session,context,inventoryDeltas,objectId:x=>new ObjectId(x)
    });
    assert.equal(updates[0].despues,"3");
    await db.collection("gruk_test_journal").insertOne({eventId:"ok"},{session});
   });
  }finally{await session.endSession();}
  assert.equal((await db.collection("inventarios").findOne({productoServicioId:id})).cantidad,3);
  assert.equal(await db.collection("gruk_test_journal").countDocuments({}),1);
  session=client.startSession();
  try{
   await assert.rejects(session.withTransaction(async()=>{
    await applyOfflineLegacyInventory({
     db,session,context,inventoryDeltas,objectId:x=>new ObjectId(x)
    });
    await db.collection("gruk_test_journal").insertOne({eventId:"rollback"},{session});
    throw Error("SIMULATED_CASH_POSTING_FAILURE");
   }),/SIMULATED_CASH_POSTING_FAILURE/);
  }finally{await session.endSession();}
  assert.equal((await db.collection("inventarios").findOne({productoServicioId:id})).cantidad,3);
  assert.equal(await db.collection("gruk_test_journal").countDocuments({}),1);
  session=client.startSession();
  try{
   await assert.rejects(session.withTransaction(async()=>{
    await applyOfflineLegacyInventory({
     db,session,context,inventoryDeltas:[{productoId,deltaUnidades:"-4"}],
     objectId:x=>new ObjectId(x)
    });
   }),e=>e.code==="OFFLINE_INVENTORY_INSUFFICIENT");
  }finally{await session.endSession();}
  assert.equal((await db.collection("inventarios").findOne({productoServicioId:id})).cantidad,3);
 }finally{await db.dropDatabase();await client.close();}
});
