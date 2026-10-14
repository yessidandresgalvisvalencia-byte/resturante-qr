"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const mongoose=require("mongoose");
const Movimiento=require("../../models/MovimientoLedgerV1000");
const Saldo=require("../../models/SaldoLedgerV1000");
const {registrarMovimiento}=require("../../services/ledgerV1000.service");
test("V1000: operaciones simultáneas con misma identidad y montos distintos nunca duplican saldo",async t=>{
 if(!process.env.TEST_MONGO_URI){t.skip("Replica set requerido");return;}
 await mongoose.connect(process.env.TEST_MONGO_URI,{dbName:"gruk_test_v1000_conflicto_concurrente",serverSelectionTimeoutMS:5000});
 const req={empresaId:"01ARZ3NDEKTSV4RRFFQ69G5FAV",sedeId:"01ARZ3NDEKTSV4RRFFQ69G5FAW",actorId:"01ARZ3NDEKTSV4RRFFQ69G5FAX",ip:"127.0.0.1",tipo:"CREDITO",montoCentavos:125,operacionId:"01ARZ3NDEKTSV4RRFFQ69G5FAY"};
 try{
  await Promise.all([Movimiento.init(),Saldo.init()]);
  const results=await Promise.allSettled([registrarMovimiento(req),registrarMovimiento({...req,montoCentavos:300})]);
  const successes=results.filter(x=>x.status==="fulfilled");
  const rejected=results.filter(x=>x.status==="rejected");
  assert.equal(successes.length,1);
  assert.equal(rejected.length,1);
  assert.match(String(rejected[0].reason?.message),/LEDGER_OPERACION_REUTILIZADA_INCONSISTENTE/);
  assert.equal(await Movimiento.countDocuments({empresaId:req.empresaId,sedeId:req.sedeId}),1);
  const head=await Saldo.findOne({empresaId:req.empresaId,sedeId:req.sedeId}).lean();
  assert.equal(head.saldoCentavos,successes[0].value.montoCentavos);
  assert.equal(head.secuencia,1);
  assert.equal(head.hashUltimo,successes[0].value.hash);
 }finally{await mongoose.connection.dropDatabase();await mongoose.disconnect();}
});
