"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const mongoose=require("mongoose");
const Movimiento=require("../../models/MovimientoLedgerV1000");
const Saldo=require("../../models/SaldoLedgerV1000");
const {hashAsiento}=require("../../core/finance/v1000/auditarLedger");
test("Reintento financiero mantiene saldo y un único asiento por operación",async t=>{
 if(!process.env.TEST_MONGO_URI){t.skip("Mongo replica set requerido");return;}
 const connection=await mongoose.createConnection(process.env.TEST_MONGO_URI,{dbName:"gruk_test_v1000_replay_ledger",serverSelectionTimeoutMS:5000}).asPromise();
 const Ledger=connection.model("MovimientoLedgerV1000",Movimiento.schema);
 const Heads=connection.model("SaldoLedgerV1000",Saldo.schema);
 const empresaId="01ARZ3NDEKTSV4RRFFQ69G5FAV",sedeId="01ARZ3NDEKTSV4RRFFQ69G5FAW",operacionId="01ARZ3NDEKTSV4RRFFQ69G5FAX";
 const doc={id:"01ARZ3NDEKTSV4RRFFQ69G5FAZ",empresaId,sedeId,operacionId,tipo:"CREDITO",montoCentavos:1,antesCentavos:0,despuesCentavos:1,secuencia:1,actorId:"01ARZ3NDEKTSV4RRFFQ69G5FAY",ip:"127.0.0.1",timestamp:new Date("2026-10-14T00:00:00.000Z"),hashAnterior:"0".repeat(64),deletedAt:null};
 doc.hash=hashAsiento(doc);
 try{
  await Promise.all([Ledger.init(),Heads.init()]);
  await Ledger.create(doc);
  await Heads.create({empresaId,sedeId,secuencia:1,saldoCentavos:1,hashUltimo:doc.hash});
  await assert.rejects(Ledger.create({...doc,id:"01ARZ3NDEKTSV4RRFFQ69G5FB0",secuencia:2,antesCentavos:1,despuesCentavos:2,hashAnterior:doc.hash,hash:"2".repeat(64)}),e=>e.code===11000);
  const found=await Ledger.findOne({empresaId,sedeId,operacionId}).lean();
  assert.equal(found.montoCentavos,1);
  assert.equal(await Ledger.countDocuments({empresaId,sedeId}),1);
  const head=await Heads.findOne({empresaId,sedeId}).lean();
  assert.equal(head.saldoCentavos,1);
  assert.equal(head.secuencia,1);
  assert.equal(head.hashUltimo,doc.hash);
 }finally{await connection.dropDatabase();await connection.close();}
});
