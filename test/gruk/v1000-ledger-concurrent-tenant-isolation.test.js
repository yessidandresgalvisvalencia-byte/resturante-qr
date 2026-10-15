"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const mongoose=require("mongoose");
const Movimiento=require("../../models/MovimientoLedgerV1000");
const Saldo=require("../../models/SaldoLedgerV1000");
const {registrarMovimiento}=require("../../services/ledgerV1000.service");
const {verificarCadena}=require("../../core/finance/v1000/auditarLedger");
test("V1000: movimientos concurrentes aíslan saldos de empresas y sedes",async t=>{
 if(!process.env.TEST_MONGO_URI){t.skip("Mongo replica set requerido");return;}
 await mongoose.connect(process.env.TEST_MONGO_URI,{dbName:"gruk_test_v1000_tenant_isolation",serverSelectionTimeoutMS:5000});
 const a="01ARZ3NDEKTSV4RRFFQ69G5FAV",b="01ARZ3NDEKTSV4RRFFQ69G5FB1";
 const x="01ARZ3NDEKTSV4RRFFQ69G5FAW",y="01ARZ3NDEKTSV4RRFFQ69G5FB2";
 const entries=[{empresaId:a,sedeId:x,montoCentavos:120,operacionId:"01ARZ3NDEKTSV4RRFFQ69G5FAY"},
  {empresaId:a,sedeId:y,montoCentavos:270,operacionId:"01ARZ3NDEKTSV4RRFFQ69G5FAZ"},
  {empresaId:b,sedeId:x,montoCentavos:390,operacionId:"01ARZ3NDEKTSV4RRFFQ69G5FB0"}];
 try{
  await Promise.all([Movimiento.init(),Saldo.init()]);
  const result=await Promise.all(entries.map(e=>registrarMovimiento({...e,tipo:"CREDITO",
   actorId:"01ARZ3NDEKTSV4RRFFQ69G5FAX",ip:"127.0.0.1"})));
  assert.equal(result.length,3);
  for(const e of entries){
   const head=await Saldo.findOne({empresaId:e.empresaId,sedeId:e.sedeId}).lean();
   const journal=await Movimiento.find({empresaId:e.empresaId,sedeId:e.sedeId}).sort({secuencia:1}).lean();
   assert.equal(head.saldoCentavos,e.montoCentavos);
   assert.equal(head.secuencia,1);
   assert.equal(journal.length,1);
   assert.equal(verificarCadena({empresaId:e.empresaId,sedeId:e.sedeId,asientos:journal,cabecera:head}).ok,true);
  }
  assert.equal(await Movimiento.countDocuments({empresaId:a}),2);
  assert.equal(await Movimiento.countDocuments({empresaId:b}),1);
  // The same operation identifier has independent identity in another company.
  // A replay must never return another tenant's accounting entry.
  const shared="01ARZ3NDEKTSV4RRFFQ69G5FB3";
  const common={sedeId:x,operacionId:shared,tipo:"CREDITO",
   actorId:"01ARZ3NDEKTSV4RRFFQ69G5FAX",ip:"127.0.0.1"};
  const [aMove,bMove]=await Promise.all([
   registrarMovimiento({...common,empresaId:a,montoCentavos:10}),
   registrarMovimiento({...common,empresaId:b,montoCentavos:20})
  ]);
  assert.notEqual(aMove.id,bMove.id);
  assert.equal(aMove.despuesCentavos,130);
  assert.equal(bMove.despuesCentavos,410);
  assert.equal((await registrarMovimiento({...common,empresaId:a,montoCentavos:10})).id,aMove.id);
  assert.equal((await registrarMovimiento({...common,empresaId:b,montoCentavos:20})).id,bMove.id);
  await assert.rejects(
   registrarMovimiento({...common,empresaId:a,montoCentavos:20}),
   /LEDGER_OPERACION_REUTILIZADA_INCONSISTENTE/
  );
  assert.equal(await Movimiento.countDocuments({operacionId:shared}),2);
  // Same identifier in two branches of the same company remains isolated.
  const sedeOperation="01ARZ3NDEKTSV4RRFFQ69G5FB4";
  const branchBase={empresaId:a,operacionId:sedeOperation,tipo:"CREDITO",
   actorId:"01ARZ3NDEKTSV4RRFFQ69G5FAX",ip:"127.0.0.1"};
  const [branchX,branchY]=await Promise.all([
   registrarMovimiento({...branchBase,sedeId:x,montoCentavos:11}),
   registrarMovimiento({...branchBase,sedeId:y,montoCentavos:22})
  ]);
  assert.notEqual(branchX.id,branchY.id);
  assert.equal((await registrarMovimiento({...branchBase,sedeId:x,montoCentavos:11})).id,branchX.id);
  assert.equal((await registrarMovimiento({...branchBase,sedeId:y,montoCentavos:22})).id,branchY.id);
  await assert.rejects(
   registrarMovimiento({...branchBase,sedeId:x,montoCentavos:22}),
   /LEDGER_OPERACION_REUTILIZADA_INCONSISTENTE/
  );
  assert.equal(await Movimiento.countDocuments({empresaId:a,operacionId:sedeOperation}),2);
  for(const item of [{sedeId:x,saldo:141},{sedeId:y,saldo:292}]){
   const cabecera=await Saldo.findOne({empresaId:a,sedeId:item.sedeId}).lean();
   const asientos=await Movimiento.find({empresaId:a,sedeId:item.sedeId}).sort({secuencia:1}).lean();
   assert.equal(cabecera.saldoCentavos,item.saldo);
   assert.equal(verificarCadena({empresaId:a,sedeId:item.sedeId,asientos,cabecera}).ok,true);
  }
 }finally{await mongoose.connection.dropDatabase();await mongoose.disconnect();}
});
