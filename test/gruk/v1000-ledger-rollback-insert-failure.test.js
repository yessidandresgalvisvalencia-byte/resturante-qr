"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const mongoose=require("mongoose");
const Movimiento=require("../../models/MovimientoLedgerV1000");
const Saldo=require("../../models/SaldoLedgerV1000");
const {registrarMovimiento}=require("../../services/ledgerV1000.service");
const {verificarCadena}=require("../../core/finance/v1000/auditarLedger");
test("V1000: fallo en inserción de movimiento revierte saldo en misma transacción",async t=>{
 if(!process.env.TEST_MONGO_URI){t.skip("Mongo replica set requerido");return;}
 await mongoose.connect(process.env.TEST_MONGO_URI,{dbName:"gruk_test_v1000_rollback_atomicity",serverSelectionTimeoutMS:5000});
 const params={empresaId:"01ARZ3NDEKTSV4RRFFQ69G5FAV",sedeId:"01ARZ3NDEKTSV4RRFFQ69G5FAW",
  actorId:"01ARZ3NDEKTSV4RRFFQ69G5FAX",operacionId:"01ARZ3NDEKTSV4RRFFQ69G5FAY",
  tipo:"CREDITO",montoCentavos:100,ip:"127.0.0.1"};
 let originalCreate;
 try{
  await Promise.all([Saldo.init(),Movimiento.init()]);
  // Fail precisely after the transactional balance update, before ledger insert.
  originalCreate=Movimiento.create;
  Movimiento.create=async function(){throw Error("TEST_INYECCION_FALLO_INSERCION");};
  await assert.rejects(registrarMovimiento(params),/TEST_INYECCION_FALLO_INSERCION/);
  assert.equal(await Movimiento.countDocuments({empresaId:params.empresaId,sedeId:params.sedeId}),0);
  const head=await Saldo.findOne({empresaId:params.empresaId,sedeId:params.sedeId}).lean();
  assert.ok(!head||head.saldoCentavos===0&&head.secuencia===0);
  // After rollback, the same operation ID must remain reusable without duplication.
  Movimiento.create=originalCreate;
  const recovered=await registrarMovimiento(params);
  assert.equal(recovered.despuesCentavos,100);
  assert.equal(recovered.secuencia,1);
  assert.equal(await Movimiento.countDocuments({empresaId:params.empresaId,sedeId:params.sedeId}),1);
  const committedHead=await Saldo.findOne({empresaId:params.empresaId,sedeId:params.sedeId}).lean();
  assert.equal(committedHead.saldoCentavos,100);
  assert.equal(committedHead.secuencia,1);
  const repeated=await registrarMovimiento(params);
  assert.equal(repeated.id,recovered.id);
  assert.equal(repeated.hash,recovered.hash);
  assert.equal(repeated.secuencia,1);
  assert.equal(await Movimiento.countDocuments({empresaId:params.empresaId,sedeId:params.sedeId}),1);
  const replayHead=await Saldo.findOne({empresaId:params.empresaId,sedeId:params.sedeId}).lean();
  assert.equal(replayHead.saldoCentavos,100);
  assert.equal(replayHead.secuencia,1);
  assert.equal(replayHead.hashUltimo,recovered.hash);
  const journal=await Movimiento.find({empresaId:params.empresaId,sedeId:params.sedeId}).sort({secuencia:1}).lean();
  const audit=verificarCadena({empresaId:params.empresaId,sedeId:params.sedeId,asientos:journal,cabecera:replayHead});
  assert.equal(audit.ok,true);
 }finally{
  if(originalCreate)Movimiento.create=originalCreate;
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
 }
});
