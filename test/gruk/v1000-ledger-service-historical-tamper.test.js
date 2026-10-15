"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const mongoose=require("mongoose");
const Movimiento=require("../../models/MovimientoLedgerV1000");
const Saldo=require("../../models/SaldoLedgerV1000");
const {registrarMovimiento}=require("../../services/ledgerV1000.service");
test("V1000: replay histórico rechaza sucesor manipulado y preserva saldo",async t=>{
 if(!process.env.TEST_MONGO_URI){t.skip("Replica set requerido");return;}
 await mongoose.connect(process.env.TEST_MONGO_URI,{dbName:"gruk_test_v1000_historical_tamper",serverSelectionTimeoutMS:5000});
 const base={empresaId:"01ARZ3NDEKTSV4RRFFQ69G5FAV",sedeId:"01ARZ3NDEKTSV4RRFFQ69G5FAW",actorId:"01ARZ3NDEKTSV4RRFFQ69G5FAX",ip:"127.0.0.1"};
 const primero={...base,tipo:"CREDITO",montoCentavos:200,operacionId:"01ARZ3NDEKTSV4RRFFQ69G5FAY"};
 try{
  await Promise.all([Movimiento.init(),Saldo.init()]);
  const a=await registrarMovimiento(primero);
  const b=await registrarMovimiento({...base,tipo:"DEBITO",montoCentavos:50,operacionId:"01ARZ3NDEKTSV4RRFFQ69G5FAZ"});
  // Simulate a privileged database writer bypassing immutable model middleware.
  await Movimiento.collection.updateOne({empresaId:base.empresaId,sedeId:base.sedeId,id:b.id},{$set:{hashAnterior:"f".repeat(64)}});
  await assert.rejects(registrarMovimiento(primero),/LEDGER_REPLAY_CADENA_INVALIDA/);
  const head=await Saldo.findOne({empresaId:base.empresaId,sedeId:base.sedeId}).lean();
  assert.equal(head.saldoCentavos,150);
  assert.equal(head.secuencia,2);
  assert.equal(head.hashUltimo,b.hash);
  assert.equal(await Movimiento.countDocuments({empresaId:base.empresaId,sedeId:base.sedeId}),2);
  assert.equal(a.secuencia,1);
 }finally{await mongoose.connection.dropDatabase();await mongoose.disconnect();}
});
