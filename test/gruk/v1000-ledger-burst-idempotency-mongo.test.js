"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const mongoose=require("mongoose");
const Movimiento=require("../../models/MovimientoLedgerV1000");
const Saldo=require("../../models/SaldoLedgerV1000");
const {registrarMovimiento}=require("../../services/ledgerV1000.service");
const {verificarCadena}=require("../../core/finance/v1000/auditarLedger");
test("V1000: ráfaga de reintentos simultáneos contabiliza solo identidades únicas",async t=>{
 if(!process.env.TEST_MONGO_URI){t.skip("Replica set MongoDB requerido");return;}
 await mongoose.connect(process.env.TEST_MONGO_URI,{dbName:"gruk_test_v1000_burst_idempotency",serverSelectionTimeoutMS:5000});
 const empresaId="01ARZ3NDEKTSV4RRFFQ69G5FAV",sedeId="01ARZ3NDEKTSV4RRFFQ69G5FAW";
 const base={empresaId,sedeId,actorId:"01ARZ3NDEKTSV4RRFFQ69G5FAX",ip:"127.0.0.1",tipo:"CREDITO"};
 const a={...base,montoCentavos:125,operacionId:"01ARZ3NDEKTSV4RRFFQ69G5FAY"};
 const b={...base,montoCentavos:250,operacionId:"01ARZ3NDEKTSV4RRFFQ69G5FAZ"};
 try{
  await Promise.all([Movimiento.init(),Saldo.init()]);
  const results=await Promise.all([a,b,a,b,a,b,a,b].map(req=>registrarMovimiento(req)));
  assert.equal(new Set(results.map(x=>x.id)).size,2);
  const rows=await Movimiento.find({empresaId,sedeId}).sort({secuencia:1}).lean();
  const head=await Saldo.findOne({empresaId,sedeId}).lean();
  assert.equal(rows.length,2);
  assert.equal(head.secuencia,2);
  assert.equal(head.saldoCentavos,375);
  assert.equal(verificarCadena({empresaId,sedeId,asientos:rows,cabecera:head}).ok,true);
 }finally{await mongoose.connection.dropDatabase();await mongoose.disconnect();}
});
