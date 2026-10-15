"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const mongoose=require("mongoose");
const Movimiento=require("../../models/MovimientoLedgerV1000");
const Saldo=require("../../models/SaldoLedgerV1000");
const {registrarMovimiento}=require("../../services/ledgerV1000.service");
const {verificarCadena}=require("../../core/finance/v1000/auditarLedger");
test("V1000: débito sin fondos revierte transacción y puede reintentarse tras abono",async t=>{
 if(!process.env.TEST_MONGO_URI){t.skip("Mongo replica set requerido");return;}
 await mongoose.connect(process.env.TEST_MONGO_URI,{dbName:"gruk_test_v1000_insufficient_funds_rollback",serverSelectionTimeoutMS:5000});
 const base={empresaId:"01ARZ3NDEKTSV4RRFFQ69G5FAV",sedeId:"01ARZ3NDEKTSV4RRFFQ69G5FAW",
  actorId:"01ARZ3NDEKTSV4RRFFQ69G5FAX",ip:"127.0.0.1"};
 const debit={...base,operacionId:"01ARZ3NDEKTSV4RRFFQ69G5FAY",tipo:"DEBITO",montoCentavos:100};
 try{
  await Promise.all([Movimiento.init(),Saldo.init()]);
  await assert.rejects(registrarMovimiento(debit),/LEDGER_SALDO_INVALIDO/);
  assert.equal(await Movimiento.countDocuments({empresaId:base.empresaId,sedeId:base.sedeId}),0);
  const initial=await Saldo.findOne({empresaId:base.empresaId,sedeId:base.sedeId}).lean();
  assert.ok(!initial||(initial.secuencia===0&&initial.saldoCentavos===0));
  const credit=await registrarMovimiento({...base,operacionId:"01ARZ3NDEKTSV4RRFFQ69G5FB0",tipo:"CREDITO",montoCentavos:150});
  assert.equal(credit.despuesCentavos,150);
  const debitResult=await registrarMovimiento(debit);
  assert.equal(debitResult.despuesCentavos,50);
  const replay=await registrarMovimiento(debit);
  assert.equal(replay.id,debitResult.id);
  const head=await Saldo.findOne({empresaId:base.empresaId,sedeId:base.sedeId}).lean();
  const journal=await Movimiento.find({empresaId:base.empresaId,sedeId:base.sedeId}).sort({secuencia:1}).lean();
  assert.equal(journal.length,2);
  assert.equal(head.saldoCentavos,50);
  assert.equal(head.secuencia,2);
  assert.equal(verificarCadena({empresaId:base.empresaId,sedeId:base.sedeId,asientos:journal,cabecera:head}).ok,true);
 }finally{await mongoose.connection.dropDatabase();await mongoose.disconnect();}
});
