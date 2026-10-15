"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const mongoose=require("mongoose");
const Movimiento=require("../../models/MovimientoLedgerV1000");
const Saldo=require("../../models/SaldoLedgerV1000");
const {registrarMovimiento}=require("../../services/ledgerV1000.service");
const {verificarCadena}=require("../../core/finance/v1000/auditarLedger");
test("V1000: ocho escrituras simultáneas mantienen saldo exacto y cadena íntegra",async t=>{
 if(!process.env.TEST_MONGO_URI){t.skip("Se requiere MongoDB con réplica");return;}
 await mongoose.connect(process.env.TEST_MONGO_URI,{dbName:"gruk_test_v1000_stress_eight",serverSelectionTimeoutMS:5000});
 const empresaId="01ARZ3NDEKTSV4RRFFQ69G5FAV",sedeId="01ARZ3NDEKTSV4RRFFQ69G5FAW";
 const amounts=[3,7,11,17,23,31,43,59];
 const ids=["01ARZ3NDEKTSV4RRFFQ69G5FB0","01ARZ3NDEKTSV4RRFFQ69G5FB1","01ARZ3NDEKTSV4RRFFQ69G5FB2","01ARZ3NDEKTSV4RRFFQ69G5FB3","01ARZ3NDEKTSV4RRFFQ69G5FB4","01ARZ3NDEKTSV4RRFFQ69G5FB5","01ARZ3NDEKTSV4RRFFQ69G5FB6","01ARZ3NDEKTSV4RRFFQ69G5FB7"];
 try{
  await Promise.all([Movimiento.init(),Saldo.init()]);
  const results=await Promise.all(amounts.map((montoCentavos,i)=>registrarMovimiento({empresaId,sedeId,actorId:"01ARZ3NDEKTSV4RRFFQ69G5FAX",ip:"127.0.0.1",tipo:"CREDITO",montoCentavos,operacionId:ids[i]})));
  assert.equal(new Set(results.map(x=>x.id)).size,8);
  const rows=await Movimiento.find({empresaId,sedeId}).sort({secuencia:1}).lean();
  const head=await Saldo.findOne({empresaId,sedeId}).lean();
  assert.equal(rows.length,8);
  assert.equal(head.saldoCentavos,amounts.reduce((a,b)=>a+b,0));
  assert.equal(head.secuencia,8);
  assert.equal(verificarCadena({empresaId,sedeId,asientos:rows,cabecera:head}).ok,true);
 }finally{await mongoose.connection.dropDatabase();await mongoose.disconnect();}
});
