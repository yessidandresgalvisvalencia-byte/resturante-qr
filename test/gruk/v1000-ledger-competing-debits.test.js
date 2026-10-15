"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const mongoose=require("mongoose");
const Movimiento=require("../../models/MovimientoLedgerV1000");
const Saldo=require("../../models/SaldoLedgerV1000");
const {registrarMovimiento}=require("../../services/ledgerV1000.service");
const {verificarCadena}=require("../../core/finance/v1000/auditarLedger");
test("V1000: dos débitos simultáneos no gastan dos veces el mismo saldo",async t=>{
 if(!process.env.TEST_MONGO_URI){t.skip("Mongo replica set requerido");return;}
 await mongoose.connect(process.env.TEST_MONGO_URI,{dbName:"gruk_test_v1000_competing_debits",serverSelectionTimeoutMS:5000});
 const base={empresaId:"01ARZ3NDEKTSV4RRFFQ69G5FAV",sedeId:"01ARZ3NDEKTSV4RRFFQ69G5FAW",
  actorId:"01ARZ3NDEKTSV4RRFFQ69G5FAX",ip:"127.0.0.1"};
 try{
  await Promise.all([Movimiento.init(),Saldo.init()]);
  await registrarMovimiento({...base,operacionId:"01ARZ3NDEKTSV4RRFFQ69G5FB0",tipo:"CREDITO",montoCentavos:100});
  const requests=["01ARZ3NDEKTSV4RRFFQ69G5FAY","01ARZ3NDEKTSV4RRFFQ69G5FAZ"].map(operacionId=>
   registrarMovimiento({...base,operacionId,tipo:"DEBITO",montoCentavos:80}));
  const results=await Promise.allSettled(requests);
  assert.equal(results.filter(x=>x.status==="fulfilled").length,1);
  assert.equal(results.filter(x=>x.status==="rejected").length,1);
  assert.match(results.find(x=>x.status==="rejected").reason.message,/LEDGER_SALDO_INVALIDO/);
  const journal=await Movimiento.find({empresaId:base.empresaId,sedeId:base.sedeId}).sort({secuencia:1}).lean();
  const head=await Saldo.findOne({empresaId:base.empresaId,sedeId:base.sedeId}).lean();
  assert.equal(journal.length,2);
  assert.equal(head.saldoCentavos,20);
  assert.equal(head.secuencia,2);
  assert.equal(verificarCadena({empresaId:base.empresaId,sedeId:base.sedeId,asientos:journal,cabecera:head}).ok,true);
 }finally{await mongoose.connection.dropDatabase();await mongoose.disconnect();}
});
