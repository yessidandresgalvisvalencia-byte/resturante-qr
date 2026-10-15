"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const mongoose=require("mongoose");
const Movimiento=require("../../models/MovimientoLedgerV1000");
const Saldo=require("../../models/SaldoLedgerV1000");
const {registrarMovimiento}=require("../../services/ledgerV1000.service");
test("V1000: cabecera adulterada impide nuevos registros sin alterar el ledger",async t=>{
 if(!process.env.TEST_MONGO_URI){t.skip("MongoDB replica set requerido");return;}
 await mongoose.connect(process.env.TEST_MONGO_URI,{dbName:"gruk_test_v1000_tamper_head",serverSelectionTimeoutMS:5000});
 const base={empresaId:"01ARZ3NDEKTSV4RRFFQ69G5FAV",sedeId:"01ARZ3NDEKTSV4RRFFQ69G5FAW",actorId:"01ARZ3NDEKTSV4RRFFQ69G5FAX",ip:"127.0.0.1",tipo:"CREDITO"};
 try{
  await Promise.all([Movimiento.init(),Saldo.init()]);
  const original=await registrarMovimiento({...base,montoCentavos:500,operacionId:"01ARZ3NDEKTSV4RRFFQ69G5FAY"});
  await Saldo.collection.updateOne({empresaId:base.empresaId,sedeId:base.sedeId},{$set:{saldoCentavos:999}});
  await assert.rejects(registrarMovimiento({...base,montoCentavos:100,operacionId:"01ARZ3NDEKTSV4RRFFQ69G5FAZ"}),/LEDGER_CADENA_INCONSISTENTE/);
  assert.equal(await Movimiento.countDocuments({empresaId:base.empresaId,sedeId:base.sedeId}),1);
  let head=await Saldo.findOne({empresaId:base.empresaId,sedeId:base.sedeId}).lean();
  assert.equal(head.saldoCentavos,999);
  assert.equal(head.secuencia,1);
  await Saldo.collection.updateOne({empresaId:base.empresaId,sedeId:base.sedeId},{$set:{saldoCentavos:500,hashUltimo:"f".repeat(64)}});
  await assert.rejects(registrarMovimiento({...base,montoCentavos:100,operacionId:"01ARZ3NDEKTSV4RRFFQ69G5FB0"}),/LEDGER_CADENA_INCONSISTENTE/);
  assert.equal(await Movimiento.countDocuments({empresaId:base.empresaId,sedeId:base.sedeId}),1);
  head=await Saldo.findOne({empresaId:base.empresaId,sedeId:base.sedeId}).lean();
  assert.equal(head.hashUltimo,"f".repeat(64));
  assert.equal(original.despuesCentavos,500);
 }finally{await mongoose.connection.dropDatabase();await mongoose.disconnect();}
});
