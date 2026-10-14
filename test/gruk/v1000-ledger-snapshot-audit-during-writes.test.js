"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const mongoose=require("mongoose");
const Movimiento=require("../../models/MovimientoLedgerV1000");
const Saldo=require("../../models/SaldoLedgerV1000");
const {registrarMovimiento}=require("../../services/ledgerV1000.service");
const {auditarLedgerEnMongo}=require("../../services/auditarLedgerV1000.service");
test("V1000: auditorías snapshot concurrentes con créditos observan estados contables íntegros",async t=>{
 if(!process.env.TEST_MONGO_URI){t.skip("Replica set MongoDB requerido");return;}
 await mongoose.connect(process.env.TEST_MONGO_URI,{dbName:"gruk_test_v1000_audit_during_writes",serverSelectionTimeoutMS:5000});
 const empresaId="01ARZ3NDEKTSV4RRFFQ69G5FAV",sedeId="01ARZ3NDEKTSV4RRFFQ69G5FAW";
 const base={empresaId,sedeId,actorId:"01ARZ3NDEKTSV4RRFFQ69G5FAX",ip:"127.0.0.1",tipo:"CREDITO"};
 try{
  await Promise.all([Movimiento.init(),Saldo.init()]);
  await registrarMovimiento({...base,montoCentavos:100,operacionId:"01ARZ3NDEKTSV4RRFFQ69G5FAY"});
  const writers=[
   registrarMovimiento({...base,montoCentavos:25,operacionId:"01ARZ3NDEKTSV4RRFFQ69G5FAZ"}),
   registrarMovimiento({...base,montoCentavos:75,operacionId:"01ARZ3NDEKTSV4RRFFQ69G5FB0"})
  ];
  const audits=Array.from({length:8},()=>auditarLedgerEnMongo({empresaId,sedeId,maxAsientos:10}));
  const [writeResults,auditResults]=await Promise.all([
   Promise.all(writers),Promise.all(audits)
  ]);
  assert.equal(writeResults.length,2);
  for(const snapshot of auditResults){
   assert.equal(snapshot.ok,true);
   assert.ok([100,125,175,200].includes(snapshot.saldoCentavos));
   assert.ok([1,2,3].includes(snapshot.secuencia));
   assert.equal(snapshot.saldoCentavos,
     snapshot.secuencia===1?100:snapshot.secuencia===3?200:snapshot.saldoCentavos);
  }
  const final=await auditarLedgerEnMongo({empresaId,sedeId,maxAsientos:10});
  assert.equal(final.saldoCentavos,200);
  assert.equal(final.secuencia,3);
  assert.equal(await Movimiento.countDocuments({empresaId,sedeId}),3);
  const head=await Saldo.findOne({empresaId,sedeId}).lean();
  assert.equal(head.hashUltimo,final.hashUltimo);
 }finally{await mongoose.connection.dropDatabase();await mongoose.disconnect();}
});
