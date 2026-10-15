"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const mongoose=require("mongoose");
const Movimiento=require("../../models/MovimientoLedgerV1000");
const Saldo=require("../../models/SaldoLedgerV1000");
const {registrarMovimiento}=require("../../services/ledgerV1000.service");
test("V1000: rechazar reuso de operacionId con importe distinto, sin alterar asiento original",async t=>{
 if(!process.env.TEST_MONGO_URI){t.skip("Mongo replica set requerido");return;}
 await mongoose.connect(process.env.TEST_MONGO_URI,{dbName:"gruk_test_v1000_collision_integrity",serverSelectionTimeoutMS:5000});
 const base={empresaId:"01ARZ3NDEKTSV4RRFFQ69G5FAV",sedeId:"01ARZ3NDEKTSV4RRFFQ69G5FAW",
 actorId:"01ARZ3NDEKTSV4RRFFQ69G5FAX",operacionId:"01ARZ3NDEKTSV4RRFFQ69G5FAY",
 tipo:"CREDITO",montoCentavos:100,ip:"127.0.0.1"};
 try{
  await Promise.all([Movimiento.init(),Saldo.init()]);
  const first=await registrarMovimiento(base);
  assert.equal(first.despuesCentavos,100);
  const replay=await registrarMovimiento(base);
  assert.equal(replay.id,first.id);
  assert.equal(replay.hash,first.hash);
  assert.equal(replay.secuencia,first.secuencia);
  await assert.rejects(registrarMovimiento({...base,montoCentavos:200}),/LEDGER_OPERACION_REUTILIZADA_INCONSISTENTE/);
  await assert.rejects(registrarMovimiento({...base,tipo:"DEBITO"}),/LEDGER_OPERACION_REUTILIZADA_INCONSISTENTE/);
  await assert.rejects(registrarMovimiento({...base,actorId:"01ARZ3NDEKTSV4RRFFQ69G5FB0"}),/LEDGER_OPERACION_REUTILIZADA_INCONSISTENTE/);
  assert.equal(await Movimiento.countDocuments({empresaId:base.empresaId,sedeId:base.sedeId}),1);
  const head=await Saldo.findOne({empresaId:base.empresaId,sedeId:base.sedeId}).lean();
  assert.equal(head.secuencia,1);
  assert.equal(head.saldoCentavos,100);
  assert.equal(head.hashUltimo,first.hash);
 }finally{await mongoose.connection.dropDatabase();await mongoose.disconnect();}
});
