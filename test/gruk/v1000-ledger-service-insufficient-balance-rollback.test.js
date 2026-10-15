"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const mongoose=require("mongoose");
const Movimiento=require("../../models/MovimientoLedgerV1000");
const Saldo=require("../../models/SaldoLedgerV1000");
const {registrarMovimiento}=require("../../services/ledgerV1000.service");
test("V1000: débito insuficiente revierte toda la transacción, sin asiento ni saldo alterado",async t=>{
 if(!process.env.TEST_MONGO_URI){t.skip("Replica set requerido");return;}
 await mongoose.connect(process.env.TEST_MONGO_URI,{dbName:"gruk_test_v1000_rollback_debito",serverSelectionTimeoutMS:5000});
 const base={empresaId:"01ARZ3NDEKTSV4RRFFQ69G5FAV",sedeId:"01ARZ3NDEKTSV4RRFFQ69G5FAW",actorId:"01ARZ3NDEKTSV4RRFFQ69G5FAX",ip:"127.0.0.1"};
 try{
  await Promise.all([Movimiento.init(),Saldo.init()]);
  const credito=await registrarMovimiento({...base,operacionId:"01ARZ3NDEKTSV4RRFFQ69G5FAY",tipo:"CREDITO",montoCentavos:100});
  await assert.rejects(registrarMovimiento({...base,operacionId:"01ARZ3NDEKTSV4RRFFQ69G5FAZ",tipo:"DEBITO",montoCentavos:101}),/LEDGER_SALDO_INVALIDO/);
  const head=await Saldo.findOne({empresaId:base.empresaId,sedeId:base.sedeId}).lean();
  assert.equal(head.saldoCentavos,100);
  assert.equal(head.secuencia,1);
  assert.equal(head.hashUltimo,credito.hash);
  assert.equal(await Movimiento.countDocuments({empresaId:base.empresaId,sedeId:base.sedeId}),1);
  const debit=await registrarMovimiento({...base,operacionId:"01ARZ3NDEKTSV4RRFFQ69G5FB0",tipo:"DEBITO",montoCentavos:40});
  assert.equal(debit.despuesCentavos,60);
  assert.equal(await Movimiento.countDocuments({empresaId:base.empresaId,sedeId:base.sedeId}),2);
 }finally{await mongoose.connection.dropDatabase();await mongoose.disconnect();}
});
