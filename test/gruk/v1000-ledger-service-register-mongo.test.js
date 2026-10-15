"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const mongoose=require("mongoose");
const Movimiento=require("../../models/MovimientoLedgerV1000");
const Saldo=require("../../models/SaldoLedgerV1000");
const {registrarMovimiento}=require("../../services/ledgerV1000.service");
const empresaId="01ARZ3NDEKTSV4RRFFQ69G5FAV";
const sedeId="01ARZ3NDEKTSV4RRFFQ69G5FAW";
const actorId="01ARZ3NDEKTSV4RRFFQ69G5FAX";
const operacionId="01ARZ3NDEKTSV4RRFFQ69G5FAY";
test("Servicio V1000 registra una sola vez y rechaza reintentos contradictorios",async t=>{
 if(!process.env.TEST_MONGO_URI){t.skip("Se requiere replica set MongoDB");return;}
 await mongoose.connect(process.env.TEST_MONGO_URI,{dbName:"gruk_test_v1000_registrar_servicio",serverSelectionTimeoutMS:5000});
 const req={empresaId,sedeId,actorId,operacionId,ip:"127.0.0.1",tipo:"CREDITO",montoCentavos:350};
 try{
  await Promise.all([Movimiento.init(),Saldo.init()]);
  const primero=await registrarMovimiento(req);
  assert.equal(primero.despuesCentavos,350);
  assert.equal(primero.secuencia,1);
  const replay=await registrarMovimiento(req);
  assert.equal(replay.id,primero.id);
  await assert.rejects(registrarMovimiento({...req,montoCentavos:351}),/LEDGER_OPERACION_REUTILIZADA_INCONSISTENTE/);
  const asientos=await Movimiento.find({empresaId,sedeId}).lean();
  assert.equal(asientos.length,1);
  const head=await Saldo.findOne({empresaId,sedeId}).lean();
  assert.equal(head.saldoCentavos,350);
  assert.equal(head.secuencia,1);
  assert.equal(head.hashUltimo,primero.hash);
 }finally{
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
 }
});
