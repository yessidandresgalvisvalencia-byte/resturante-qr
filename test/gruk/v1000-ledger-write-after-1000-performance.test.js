"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {performance}=require("node:perf_hooks");
const mongoose=require("mongoose");
const Movimiento=require("../../models/MovimientoLedgerV1000");
const Saldo=require("../../models/SaldoLedgerV1000");
const {hashAsiento}=require("../../core/finance/v1000/auditarLedger");
const {registrarMovimiento}=require("../../services/ledgerV1000.service");
const ABC="0123456789ABCDEFGHJKMNPQRSTVWXYZ";
function id(n){let s="";for(let i=0;i<16;i++){s=ABC[n%32]+s;n=Math.floor(n/32);}return "01ARZ3NDEK"+s;}
test("V1000: medir latencia de escritura tras auditar historial de 1000 asientos",async t=>{
 if(!process.env.TEST_MONGO_URI){t.skip("Replica set MongoDB requerido");return;}
 await mongoose.connect(process.env.TEST_MONGO_URI,{dbName:"gruk_test_v1000_write_audit_performance",serverSelectionTimeoutMS:5000});
 const empresaId=id(80001),sedeId=id(80002),actorId=id(80003),ip="127.0.0.1";
 try{
  await Promise.all([Movimiento.init(),Saldo.init()]);
  const docs=[];let anterior="0".repeat(64);
  for(let i=1;i<=1000;i++){
   const m={id:id(i),operacionId:id(i+10000),empresaId,sedeId,tipo:"CREDITO",montoCentavos:1,
    antesCentavos:i-1,despuesCentavos:i,secuencia:i,actorId,ip,
    timestamp:new Date("2026-10-14T00:00:00.000Z"),hashAnterior:anterior,deletedAt:null};
   m.hash=hashAsiento(m);anterior=m.hash;docs.push(m);
  }
  await Movimiento.insertMany(docs,{ordered:true});
  await Saldo.create({empresaId,sedeId,secuencia:1000,saldoCentavos:1000,hashUltimo:anterior});
  const durations=[];
  for(let i=1;i<=20;i++){
   const start=performance.now();
   const result=await registrarMovimiento({empresaId,sedeId,tipo:"CREDITO",montoCentavos:1,actorId,ip,operacionId:id(20000+i)});
   durations.push(performance.now()-start);
   assert.equal(result.secuencia,1000+i);
   assert.equal(result.despuesCentavos,1000+i);
  }
  assert.equal(await Movimiento.countDocuments({empresaId,sedeId}),1020);
  assert.equal((await Saldo.findOne({empresaId,sedeId}).lean()).saldoCentavos,1020);
  const ordered=[...durations].sort((a,b)=>a-b);
  const nearest=p=>ordered[Math.ceil(p*ordered.length)-1].toFixed(2);
  t.diagnostic("mongo_ledger_write_1000_start_n=20_p50_ms="+nearest(0.5)+
   "_p95_ms="+nearest(0.95)+"_p99_ms="+nearest(0.99));
 }finally{
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
 }
});
