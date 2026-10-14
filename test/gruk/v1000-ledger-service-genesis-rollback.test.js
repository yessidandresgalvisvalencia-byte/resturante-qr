"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const mongoose=require("mongoose");
const Movimiento=require("../../models/MovimientoLedgerV1000");
const Saldo=require("../../models/SaldoLedgerV1000");
const {registrarMovimiento}=require("../../services/ledgerV1000.service");
test("V1000: un débito inicial fallido revierte también la creación de cabecera",async t=>{
 if(!process.env.TEST_MONGO_URI){t.skip("MongoDB replica set requerido");return;}
 await mongoose.connect(process.env.TEST_MONGO_URI,{dbName:"gruk_test_v1000_rollback_genesis",serverSelectionTimeoutMS:5000});
 const base={empresaId:"01ARZ3NDEKTSV4RRFFQ69G5FAV",sedeId:"01ARZ3NDEKTSV4RRFFQ69G5FAW",actorId:"01ARZ3NDEKTSV4RRFFQ69G5FAX",ip:"127.0.0.1"};
 try{
  await Promise.all([Movimiento.init(),Saldo.init()]);
  await assert.rejects(registrarMovimiento({...base,tipo:"DEBITO",montoCentavos:1,operacionId:"01ARZ3NDEKTSV4RRFFQ69G5FAY"}),/LEDGER_SALDO_INVALIDO/);
  assert.equal(await Saldo.countDocuments({empresaId:base.empresaId,sedeId:base.sedeId}),0);
  assert.equal(await Movimiento.countDocuments({empresaId:base.empresaId,sedeId:base.sedeId}),0);
  const registered=await registrarMovimiento({...base,tipo:"CREDITO",montoCentavos:50,operacionId:"01ARZ3NDEKTSV4RRFFQ69G5FAZ"});
  assert.equal(registered.secuencia,1);
  assert.equal(registered.antesCentavos,0);
  assert.equal(registered.despuesCentavos,50);
  assert.equal(await Saldo.countDocuments({empresaId:base.empresaId,sedeId:base.sedeId}),1);
 }finally{await mongoose.connection.dropDatabase();await mongoose.disconnect();}
});
