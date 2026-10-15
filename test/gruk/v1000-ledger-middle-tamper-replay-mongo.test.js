"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const mongoose=require("mongoose");
const Movimiento=require("../../models/MovimientoLedgerV1000");
const Saldo=require("../../models/SaldoLedgerV1000");
const {registrarMovimiento}=require("../../services/ledgerV1000.service");
test("V1000 replay rechaza manipulación en asiento intermedio aunque extremos sean válidos",async t=>{
 if(!process.env.TEST_MONGO_URI){t.skip("Replica set requerido");return;}
 await mongoose.connect(process.env.TEST_MONGO_URI,{dbName:"gruk_test_v1000_middle_tamper_replay",serverSelectionTimeoutMS:5000});
 const base={empresaId:"01ARZ3NDEKTSV4RRFFQ69G5FAV",sedeId:"01ARZ3NDEKTSV4RRFFQ69G5FAW",actorId:"01ARZ3NDEKTSV4RRFFQ69G5FAX",ip:"127.0.0.1",tipo:"CREDITO",montoCentavos:10};
 const first={...base,operacionId:"01ARZ3NDEKTSV4RRFFQ69G5FAY"};
 try{
  await Promise.all([Movimiento.init(),Saldo.init()]);
  await registrarMovimiento(first);
  await registrarMovimiento({...base,operacionId:"01ARZ3NDEKTSV4RRFFQ69G5FAZ"});
  await registrarMovimiento({...base,operacionId:"01ARZ3NDEKTSV4RRFFQ69G5FB0"});
  await registrarMovimiento({...base,operacionId:"01ARZ3NDEKTSV4RRFFQ69G5FB1"});
  await Movimiento.collection.updateOne({empresaId:base.empresaId,sedeId:base.sedeId,secuencia:3},{$set:{montoCentavos:999}});
  await assert.rejects(registrarMovimiento(first),/LEDGER_REPLAY_CADENA_INVALIDA/);
  assert.equal(await Movimiento.countDocuments({empresaId:base.empresaId,sedeId:base.sedeId}),4);
  const head=await Saldo.findOne({empresaId:base.empresaId,sedeId:base.sedeId}).lean();
  assert.equal(head.saldoCentavos,40);
 }finally{await mongoose.connection.dropDatabase();await mongoose.disconnect();}
});
