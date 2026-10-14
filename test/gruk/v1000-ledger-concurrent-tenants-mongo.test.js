"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const mongoose=require("mongoose");
const Movimiento=require("../../models/MovimientoLedgerV1000");
const Saldo=require("../../models/SaldoLedgerV1000");
const {registrarMovimiento}=require("../../services/ledgerV1000.service");
const {verificarCadena}=require("../../core/finance/v1000/auditarLedger");
test("V1000: concurrentes de distintos tenants mantienen cabeceras y asientos aislados",async t=>{
 if(!process.env.TEST_MONGO_URI){t.skip("Replica set MongoDB requerido");return;}
 await mongoose.connect(process.env.TEST_MONGO_URI,{dbName:"gruk_test_v1000_cross_tenant_concurrency",serverSelectionTimeoutMS:5000});
 const one={empresaId:"01ARZ3NDEKTSV4RRFFQ69G5FAV",sedeId:"01ARZ3NDEKTSV4RRFFQ69G5FAW"};
 const two={empresaId:"01ARZ3NDEKTSV4RRFFQ69G5FB0",sedeId:"01ARZ3NDEKTSV4RRFFQ69G5FB1"};
 const base={actorId:"01ARZ3NDEKTSV4RRFFQ69G5FAX",ip:"127.0.0.1",tipo:"CREDITO"};
 try{
  await Promise.all([Movimiento.init(),Saldo.init()]);
  const sameOperationId="01ARZ3NDEKTSV4RRFFQ69G5FAY";
  await Promise.all([
   registrarMovimiento({...base,...one,montoCentavos:123,operacionId:sameOperationId}),
   registrarMovimiento({...base,...two,montoCentavos:456,operacionId:sameOperationId})
  ]);
  for(const [tenant,expected] of [[one,123],[two,456]]){
   const rows=await Movimiento.find(tenant).sort({secuencia:1}).lean();
   const head=await Saldo.findOne(tenant).lean();
   assert.equal(rows.length,1);
   assert.equal(head.secuencia,1);
   assert.equal(head.saldoCentavos,expected);
   assert.equal(rows[0].montoCentavos,expected);
   assert.equal(verificarCadena({...tenant,asientos:rows,cabecera:head}).ok,true);
  }
  assert.equal(await Movimiento.countDocuments({operacionId:sameOperationId}),2);
 }finally{await mongoose.connection.dropDatabase();await mongoose.disconnect();}
});
