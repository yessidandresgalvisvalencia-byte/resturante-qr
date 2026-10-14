"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const mongoose=require("mongoose");
const Movimiento=require("../../models/MovimientoLedgerV1000");
const Saldo=require("../../models/SaldoLedgerV1000");
const {registrarMovimiento}=require("../../services/ledgerV1000.service");
const {verificarCadena}=require("../../core/finance/v1000/auditarLedger");
test("V1000: dos sedes de una empresa contabilizan independientemente aun con operacionId igual",async t=>{
 if(!process.env.TEST_MONGO_URI){t.skip("Replica set requerido");return;}
 await mongoose.connect(process.env.TEST_MONGO_URI,{dbName:"gruk_test_v1000_same_company_multi_sede",serverSelectionTimeoutMS:5000});
 const empresaId="01ARZ3NDEKTSV4RRFFQ69G5FAV";
 const sedes=["01ARZ3NDEKTSV4RRFFQ69G5FAW","01ARZ3NDEKTSV4RRFFQ69G5FB0"];
 const base={empresaId,actorId:"01ARZ3NDEKTSV4RRFFQ69G5FAX",ip:"127.0.0.1",tipo:"CREDITO",operacionId:"01ARZ3NDEKTSV4RRFFQ69G5FAY"};
 try{
  await Promise.all([Movimiento.init(),Saldo.init()]);
  await Promise.all([
   registrarMovimiento({...base,sedeId:sedes[0],montoCentavos:125}),
   registrarMovimiento({...base,sedeId:sedes[1],montoCentavos:375})
  ]);
  for(const [index,sedeId] of sedes.entries()){
   const tenant={empresaId,sedeId};
   const rows=await Movimiento.find(tenant).sort({secuencia:1}).lean();
   const head=await Saldo.findOne(tenant).lean();
   assert.equal(rows.length,1);
   assert.equal(head.secuencia,1);
   assert.equal(head.saldoCentavos,index===0?125:375);
   assert.equal(verificarCadena({...tenant,asientos:rows,cabecera:head}).ok,true);
  }
  assert.equal(await Movimiento.countDocuments({empresaId,operacionId:base.operacionId}),2);
  assert.equal(await Saldo.countDocuments({empresaId}),2);
 }finally{await mongoose.connection.dropDatabase();await mongoose.disconnect();}
});
