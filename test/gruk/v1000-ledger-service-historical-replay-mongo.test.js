"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const mongoose=require("mongoose");
const Movimiento=require("../../models/MovimientoLedgerV1000");
const Saldo=require("../../models/SaldoLedgerV1000");
const {registrarMovimiento}=require("../../services/ledgerV1000.service");
test("V1000: replay histórico no cambia el saldo ni la cadena tras movimientos posteriores",async t=>{
 if(!process.env.TEST_MONGO_URI){t.skip("Replica set requerido");return;}
 await mongoose.connect(process.env.TEST_MONGO_URI,{dbName:"gruk_test_v1000_historical_replay_service",serverSelectionTimeoutMS:5000});
 const base={empresaId:"01ARZ3NDEKTSV4RRFFQ69G5FAV",sedeId:"01ARZ3NDEKTSV4RRFFQ69G5FAW",actorId:"01ARZ3NDEKTSV4RRFFQ69G5FAX",ip:"127.0.0.1"};
 const primero={...base,tipo:"CREDITO",montoCentavos:200,operacionId:"01ARZ3NDEKTSV4RRFFQ69G5FAY"};
 try{
  await Promise.all([Movimiento.init(),Saldo.init()]);
  const a=await registrarMovimiento(primero);
  const b=await registrarMovimiento({...base,tipo:"DEBITO",montoCentavos:70,operacionId:"01ARZ3NDEKTSV4RRFFQ69G5FAZ"});
  assert.equal(b.hashAnterior,a.hash);
  const original=await registrarMovimiento(primero);
  assert.equal(original.id,a.id);
  assert.equal(original.hash,a.hash);
  assert.equal(await Movimiento.countDocuments({empresaId:base.empresaId,sedeId:base.sedeId}),2);
  const head=await Saldo.findOne({empresaId:base.empresaId,sedeId:base.sedeId}).lean();
  assert.equal(head.secuencia,2);
  assert.equal(head.saldoCentavos,130);
  assert.equal(head.hashUltimo,b.hash);
 }finally{await mongoose.connection.dropDatabase();await mongoose.disconnect();}
});
