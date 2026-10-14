"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const mongoose=require("mongoose");
const Ledger=require("../../models/MovimientoLedgerV1000");
const {hashAsiento}=require("../../core/finance/v1000/auditarLedger");
test("V1000 no admite el mismo operacionId en dos asientos del mismo tenant",async t=>{
 if(!process.env.TEST_MONGO_URI){t.skip("Mongo replica set requerido");return;}
 const connection=await mongoose.createConnection(process.env.TEST_MONGO_URI,{dbName:"gruk_test_v1000_operacion_unica",serverSelectionTimeoutMS:5000}).asPromise();
 const Model=connection.model("MovimientoLedgerV1000",Ledger.schema);
 const empresaId="01ARZ3NDEKTSV4RRFFQ69G5FAV",sedeId="01ARZ3NDEKTSV4RRFFQ69G5FAW";
 const operacionId="01ARZ3NDEKTSV4RRFFQ69G5FAX";
 const base={empresaId,sedeId,operacionId,tipo:"CREDITO",montoCentavos:1,antesCentavos:0,despuesCentavos:1,actorId:"01ARZ3NDEKTSV4RRFFQ69G5FAY",ip:"127.0.0.1",timestamp:new Date("2026-10-14T00:00:00Z"),deletedAt:null,hashAnterior:"0".repeat(64)};
 try{
  await Model.init();
  const first={...base,id:"01ARZ3NDEKTSV4RRFFQ69G5FAZ",secuencia:1};
  first.hash=hashAsiento(first);
  await Model.create(first);
  const second={...base,id:"01ARZ3NDEKTSV4RRFFQ69G5FBB",secuencia:2,antesCentavos:1,despuesCentavos:2,hashAnterior:first.hash};
  second.hash=hashAsiento(second);
  await assert.rejects(Model.create(second),err=>err.code===11000);
  assert.equal(await Model.countDocuments({empresaId,sedeId,operacionId}),1);
 }finally{
  await connection.dropDatabase();
  await connection.close();
 }
});
