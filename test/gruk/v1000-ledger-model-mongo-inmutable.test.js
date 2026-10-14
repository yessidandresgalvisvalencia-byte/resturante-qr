"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const mongoose=require("mongoose");
const Ledger=require("../../models/MovimientoLedgerV1000");

test("Ledger V1000: MongoDB no modifica asientos existentes via API Mongoose",async t=>{
 if(!process.env.TEST_MONGO_URI){t.skip("Requiere TEST_MONGO_URI replica set");return;}
 const connection=await mongoose.createConnection(process.env.TEST_MONGO_URI,{
   dbName:"gruk_test_v1000_inmutable",serverSelectionTimeoutMS:5000
 }).asPromise();
 const Model=connection.model("MovimientoLedgerV1000",Ledger.schema);
 const doc={
  id:"01ARZ3NDEKTSV4RRFFQ69G5FAV",empresaId:"01ARZ3NDEKTSV4RRFFQ69G5FAW",
  sedeId:"01ARZ3NDEKTSV4RRFFQ69G5FAX",secuencia:1,tipo:"CREDITO",
  montoCentavos:1,antesCentavos:0,despuesCentavos:1,
  actorId:"01ARZ3NDEKTSV4RRFFQ69G5FAY",ip:"127.0.0.1",
  timestamp:new Date("2026-10-14T12:00:00Z"),hashAnterior:"0".repeat(64),
  hash:"1".repeat(64),deletedAt:null
 };
 try{
  await Model.init();
  await Model.create(doc);
  const row=await Model.findOne({empresaId:doc.empresaId,sedeId:doc.sedeId});
  row.montoCentavos=50;
  await assert.rejects(row.save(),/LEDGER_APPEND_ONLY|immutable/);
  await assert.rejects(Model.updateOne({id:doc.id},{$set:{montoCentavos:50}}),/LEDGER_APPEND_ONLY/);
  await assert.rejects(Model.deleteMany({empresaId:doc.empresaId}),/LEDGER_APPEND_ONLY/);
  await assert.rejects(Model.bulkWrite([{deleteMany:{filter:{empresaId:doc.empresaId}}}]),/LEDGER_BULK_WRITE_PROHIBIDO/);
  const stored=await Model.findOne({id:doc.id}).lean();
  assert.equal(stored.montoCentavos,1);
  assert.equal(await Model.countDocuments({empresaId:doc.empresaId,sedeId:doc.sedeId}),1);
 }finally{
  await connection.dropDatabase();
  await connection.close();
 }
});
