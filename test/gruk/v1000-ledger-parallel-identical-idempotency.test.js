"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const mongoose=require("mongoose");
const Movimiento=require("../../models/MovimientoLedgerV1000");
const Saldo=require("../../models/SaldoLedgerV1000");
const {registrarMovimiento}=require("../../services/ledgerV1000.service");
test("V1000: veinte solicitudes simultáneas con la misma operación generan un asiento",async t=>{
 if(!process.env.TEST_MONGO_URI){t.skip("Replica set requerido");return;}
 await mongoose.connect(process.env.TEST_MONGO_URI,{dbName:"gruk_test_v1000_parallel_idempotency",serverSelectionTimeoutMS:5000});
 const empresaId="01ARZ3NDEKTSV4RRFFQ69G5FAV",sedeId="01ARZ3NDEKTSV4RRFFQ69G5FAW";
 const request={empresaId,sedeId,actorId:"01ARZ3NDEKTSV4RRFFQ69G5FAX",
  operacionId:"01ARZ3NDEKTSV4RRFFQ69G5FAY",tipo:"CREDITO",montoCentavos:100,ip:"127.0.0.1"};
 try{
  await Promise.all([Movimiento.init(),Saldo.init()]);
  const results=await Promise.allSettled(Array.from({length:20},()=>registrarMovimiento(request)));
  const successful=results.filter(r=>r.status==="fulfilled");
  assert.ok(successful.length>=1);
  for(const result of successful){
   assert.equal(result.value.operacionId,request.operacionId);
   assert.equal(result.value.montoCentavos,100);
   assert.equal(result.value.secuencia,1);
  }
  for(const result of results.filter(r=>r.status==="rejected")){
   assert.ok(result.reason instanceof Error);
  }
  assert.equal(await Movimiento.countDocuments({empresaId,sedeId,operacionId:request.operacionId}),1);
  assert.equal(await Movimiento.countDocuments({empresaId,sedeId}),1);
  const head=await Saldo.findOne({empresaId,sedeId}).lean();
  assert.equal(head.saldoCentavos,100);
  assert.equal(head.secuencia,1);
  t.diagnostic("parallel_same_operation_success="+successful.length+"_rejected="+(20-successful.length));
 }finally{await mongoose.connection.dropDatabase();await mongoose.disconnect();}
});
