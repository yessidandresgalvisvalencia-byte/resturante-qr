"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const mongoose=require("mongoose");
const Movimiento=require("../../models/MovimientoLedgerV1000");
const Saldo=require("../../models/SaldoLedgerV1000");
const {registrarMovimiento}=require("../../services/ledgerV1000.service");
test("V1000: replay de operación histórica no tolera cabecera de último asiento manipulada",async t=>{
 if(!process.env.TEST_MONGO_URI){t.skip("MongoDB replica set requerido");return;}
 await mongoose.connect(process.env.TEST_MONGO_URI,{dbName:"gruk_test_v1000_replay_tampered_head",serverSelectionTimeoutMS:5000});
 const base={empresaId:"01ARZ3NDEKTSV4RRFFQ69G5FAV",sedeId:"01ARZ3NDEKTSV4RRFFQ69G5FAW",actorId:"01ARZ3NDEKTSV4RRFFQ69G5FAX",ip:"127.0.0.1"};
 const first={...base,tipo:"CREDITO",montoCentavos:300,operacionId:"01ARZ3NDEKTSV4RRFFQ69G5FAY"};
 try{
  await Promise.all([Movimiento.init(),Saldo.init()]);
  await registrarMovimiento(first);
  await registrarMovimiento({...base,tipo:"DEBITO",montoCentavos:100,operacionId:"01ARZ3NDEKTSV4RRFFQ69G5FAZ"});
  await Saldo.collection.updateOne({empresaId:base.empresaId,sedeId:base.sedeId},{$set:{saldoCentavos:999}});
  await assert.rejects(registrarMovimiento(first),/LEDGER_REPLAY_CADENA_INVALIDA/);
  const rows=await Movimiento.find({empresaId:base.empresaId,sedeId:base.sedeId}).lean();
  assert.equal(rows.length,2);
  const head=await Saldo.findOne({empresaId:base.empresaId,sedeId:base.sedeId}).lean();
  assert.equal(head.saldoCentavos,999);
  assert.equal(head.secuencia,2);
 }finally{await mongoose.connection.dropDatabase();await mongoose.disconnect();}
});
