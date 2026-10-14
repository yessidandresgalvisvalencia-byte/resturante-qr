"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {MongoClient,ObjectId}=require("mongodb");

test("Ledger V1000: secuencia unica por empresa y sede con rollback ACID",async t=>{
 if(!process.env.TEST_MONGO_URI){t.skip("Replica set requerido");return;}
 const client=new MongoClient(process.env.TEST_MONGO_URI,{serverSelectionTimeoutMS:5000});
 await client.connect();
 const db=client.db("gruk_test_v1000_ledger_sequence");
 const ledger=db.collection("movimientos");
 const heads=db.collection("saldos");
 const empresaId="01ARZ3NDEKTSV4RRFFQ69G5FAV";
 const sedeId="01ARZ3NDEKTSV4RRFFQ69G5FAW";
 const session=client.startSession();
 try{
  await ledger.createIndex({empresaId:1,sedeId:1,secuencia:1},{unique:true});
  await heads.insertOne({empresaId,sedeId,saldoCentavos:0,secuencia:0});
  await session.withTransaction(async()=>{
   await ledger.insertOne({empresaId,sedeId,secuencia:1,montoCentavos:5200000},{session});
   await heads.updateOne({empresaId,sedeId,secuencia:0},{$set:{secuencia:1,saldoCentavos:5200000}},{session});
  });
  await assert.rejects(session.withTransaction(async()=>{
   await ledger.insertOne({empresaId,sedeId,secuencia:2,montoCentavos:100},{session});
   await heads.updateOne({empresaId,sedeId,secuencia:1},{$set:{secuencia:2,saldoCentavos:5200100}},{session});
   throw new Error("ROLLBACK_LEDGER_V1000");
  }),/ROLLBACK_LEDGER_V1000/);
  assert.equal(await ledger.countDocuments({empresaId,sedeId}),1);
  assert.equal((await heads.findOne({empresaId,sedeId})).saldoCentavos,5200000);
  await assert.rejects(ledger.insertOne({empresaId,sedeId,secuencia:1,montoCentavos:500}),err=>err.code===11000);
  assert.equal(await ledger.countDocuments({empresaId,sedeId}),1);
 }finally{
  await session.endSession();
  await db.dropDatabase();
  await client.close();
 }
});
