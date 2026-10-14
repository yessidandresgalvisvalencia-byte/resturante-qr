"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const mongoose=require("mongoose");
const Ledger=require("../../models/MovimientoLedgerV1000");
const Saldo=require("../../models/SaldoLedgerV1000");
const {hashAsiento}=require("../../core/finance/v1000/auditarLedger");
test("V1000: reintento contradictorio de operacionId no modifica saldo ni primer asiento",async t=>{
 if(!process.env.TEST_MONGO_URI){t.skip("Replica set requerido");return;}
 const connection=await mongoose.createConnection(process.env.TEST_MONGO_URI,{dbName:"gruk_test_v1000_replay_conflict",serverSelectionTimeoutMS:5000}).asPromise();
 const Movimiento=connection.model("MovimientoLedgerV1000",Ledger.schema);
 const Cabecera=connection.model("SaldoLedgerV1000",Saldo.schema);
 const empresaId="01ARZ3NDEKTSV4RRFFQ69G5FAV",sedeId="01ARZ3NDEKTSV4RRFFQ69G5FAW",operacionId="01ARZ3NDEKTSV4RRFFQ69G5FAX";
 const original={id:"01ARZ3NDEKTSV4RRFFQ69G5FAZ",empresaId,sedeId,operacionId,tipo:"CREDITO",montoCentavos:200,antesCentavos:0,despuesCentavos:200,secuencia:1,actorId:"01ARZ3NDEKTSV4RRFFQ69G5FAY",ip:"127.0.0.1",timestamp:new Date("2026-10-14T00:00:00.000Z"),hashAnterior:"0".repeat(64),deletedAt:null};
 original.hash=hashAsiento(original);
 try{
  await Promise.all([Movimiento.init(),Cabecera.init()]);
  const session=await connection.startSession();
  try{
   await session.withTransaction(async()=>{
    await Movimiento.create([original],{session});
    await Cabecera.create([{empresaId,sedeId,secuencia:1,saldoCentavos:200,hashUltimo:original.hash}],{session});
   });
   const conflict={...original,id:"01ARZ3NDEKTSV4RRFFQ69G5FB0",montoCentavos:300,despuesCentavos:300,hash:undefined};
   conflict.hash=hashAsiento(conflict);
   await assert.rejects(session.withTransaction(async()=>{
    await Movimiento.create([conflict],{session});
    await Cabecera.updateOne({empresaId,sedeId},{$inc:{saldoCentavos:300,secuencia:1}},{session});
   }),error=>error.code===11000);
  }finally{await session.endSession();}
  const rows=await Movimiento.find({empresaId,sedeId,operacionId}).lean();
  assert.equal(rows.length,1);
  assert.equal(rows[0].montoCentavos,200);
  const head=await Cabecera.findOne({empresaId,sedeId}).lean();
  assert.equal(head.saldoCentavos,200);
  assert.equal(head.secuencia,1);
  assert.equal(head.hashUltimo,original.hash);
 }finally{await connection.dropDatabase();await connection.close();}
});
