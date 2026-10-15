"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const mongoose=require("mongoose");
const Movimiento=require("../../models/MovimientoLedgerV1000");
const Saldo=require("../../models/SaldoLedgerV1000");
const {registrarMovimiento}=require("../../services/ledgerV1000.service");
test("V1000 soporta dos registros concurrentes distintos y serializa el saldo",async t=>{
 if(!process.env.TEST_MONGO_URI){t.skip("Mongo replica set requerido");return;}
 await mongoose.connect(process.env.TEST_MONGO_URI,{dbName:"gruk_test_v1000_service_concurrency",serverSelectionTimeoutMS:5000});
 const empresaId="01ARZ3NDEKTSV4RRFFQ69G5FAV",sedeId="01ARZ3NDEKTSV4RRFFQ69G5FAW",actorId="01ARZ3NDEKTSV4RRFFQ69G5FAX",ip="127.0.0.1";
 try{
  await Promise.all([Movimiento.init(),Saldo.init()]);
  const one={empresaId,sedeId,actorId,ip,tipo:"CREDITO",montoCentavos:150,operacionId:"01ARZ3NDEKTSV4RRFFQ69G5FAY"};
  const two={...one,montoCentavos:270,operacionId:"01ARZ3NDEKTSV4RRFFQ69G5FAZ"};
  const [a,b]=await Promise.all([registrarMovimiento(one),registrarMovimiento(two)]);
  assert.notEqual(a.id,b.id);
  assert.equal(await Movimiento.countDocuments({empresaId,sedeId}),2);
  const head=await Saldo.findOne({empresaId,sedeId}).lean();
  assert.equal(head.saldoCentavos,420);
  assert.equal(head.secuencia,2);
  const rows=await Movimiento.find({empresaId,sedeId}).sort({secuencia:1}).lean();
  assert.equal(rows[0].hashAnterior,"0".repeat(64));
  assert.equal(rows[1].hashAnterior,rows[0].hash);
  assert.equal(rows[1].despuesCentavos,420);
 }finally{await mongoose.connection.dropDatabase();await mongoose.disconnect();}
});
