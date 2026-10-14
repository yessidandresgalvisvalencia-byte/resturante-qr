"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const mongoose=require("mongoose");
const Movimiento=require("../../models/MovimientoLedgerV1000");
const Saldo=require("../../models/SaldoLedgerV1000");
const {registrarMovimiento}=require("../../services/ledgerV1000.service");
const {verificarCadena}=require("../../core/finance/v1000/auditarLedger");
test("V1000: débito rechazado por concurrencia no reserva fondos ni bloquea nuevo crédito",async t=>{
 if(!process.env.TEST_MONGO_URI){t.skip("Replica set MongoDB requerido");return;}
 await mongoose.connect(process.env.TEST_MONGO_URI,{dbName:"gruk_test_v1000_overdraft_recovery",serverSelectionTimeoutMS:5000});
 const empresaId="01ARZ3NDEKTSV4RRFFQ69G5FAV",sedeId="01ARZ3NDEKTSV4RRFFQ69G5FAW";
 const base={empresaId,sedeId,actorId:"01ARZ3NDEKTSV4RRFFQ69G5FAX",ip:"127.0.0.1"};
 try{
  await Promise.all([Movimiento.init(),Saldo.init()]);
  await registrarMovimiento({...base,tipo:"CREDITO",montoCentavos:100,operacionId:"01ARZ3NDEKTSV4RRFFQ69G5FAY"});
  const results=await Promise.allSettled([
   registrarMovimiento({...base,tipo:"DEBITO",montoCentavos:80,operacionId:"01ARZ3NDEKTSV4RRFFQ69G5FAZ"}),
   registrarMovimiento({...base,tipo:"DEBITO",montoCentavos:80,operacionId:"01ARZ3NDEKTSV4RRFFQ69G5FB0"})
  ]);
  assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
  assert.equal(results.filter(r=>r.status==="rejected").length,1);
  const recovered=await registrarMovimiento({...base,tipo:"CREDITO",montoCentavos:50,operacionId:"01ARZ3NDEKTSV4RRFFQ69G5FB1"});
  assert.equal(recovered.despuesCentavos,70);
  const rows=await Movimiento.find({empresaId,sedeId}).sort({secuencia:1}).lean();
  const head=await Saldo.findOne({empresaId,sedeId}).lean();
  assert.equal(rows.length,3);
  assert.equal(head.saldoCentavos,70);
  assert.equal(head.secuencia,3);
  assert.equal(verificarCadena({empresaId,sedeId,asientos:rows,cabecera:head}).ok,true);
 }finally{await mongoose.connection.dropDatabase();await mongoose.disconnect();}
});
