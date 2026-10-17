"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
test("partial unique offline order key rejects concurrent repeats and leaves legacy orders intact",{timeout:120000},async t=>{
 if(!process.env.GRUK_TEST_MONGO_URI){t.skip("Mongo replica-set integration CI only");return;}
 const mongoose=require("mongoose");
 const Pedido=require("../../models/pedido");
 const {MongoClient}=require("mongodb");
 const client=new MongoClient(process.env.GRUK_TEST_MONGO_URI);
 try{
  await client.connect();const db=client.db("gruk_offline_pedido_unique");
  const coll=db.collection("pedidos");
  const index=Pedido.schema.indexes().find(([key])=>key.offlineEventId===1);
  assert.ok(index,"Pedido model must advertise offline unique index");
  assert.equal(index[1].unique,true);
  await coll.createIndex(index[0],index[1]);
  const empresaId=new mongoose.Types.ObjectId();
  const doc={empresaId,sedeId:"S1",offlineEventId:"01ARZ3NDEKTSV4RRFFQ69G5FAV",restaurantId:"rest1"};
  const results=await Promise.allSettled([coll.insertOne({...doc}),coll.insertOne({...doc})]);
  assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
  assert.equal(results.filter(r=>r.status==="rejected"&&r.reason.code===11000).length,1);
  assert.equal(await coll.countDocuments({empresaId,sedeId:"S1"}),1);
  await coll.insertOne({restaurantId:"old1"});
  await coll.insertOne({restaurantId:"old2"});
  assert.equal(await coll.countDocuments({offlineEventId:{$exists:false}}),2);
 }finally{await client.close();}
});
