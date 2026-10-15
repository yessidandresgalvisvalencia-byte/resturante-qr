"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {performance}=require("node:perf_hooks");
const mongoose=require("mongoose");
const Movimiento=require("../../models/MovimientoLedgerV1000");
const Saldo=require("../../models/SaldoLedgerV1000");
const {hashAsiento}=require("../../core/finance/v1000/auditarLedger");
const {auditarLedgerEnMongo}=require("../../services/auditarLedgerV1000.service");
const ABC="0123456789ABCDEFGHJKMNPQRSTVWXYZ";
function id(n){let s="";for(let i=0;i<16;i++){s=ABC[n%32]+s;n=Math.floor(n/32);}return "01ARZ3NDEK"+s;}
test("V1000: ocho auditorías Mongo concurrentes devuelven la misma cadena válida",async t=>{
 if(!process.env.TEST_MONGO_URI){t.skip("Replica set requerido");return;}
 await mongoose.connect(process.env.TEST_MONGO_URI,{dbName:"gruk_test_v1000_concurrent_audit_perf",serverSelectionTimeoutMS:5000});
 const empresaId=id(20001),sedeId=id(20002),actorId=id(20003);
 try{
  await Promise.all([Movimiento.init(),Saldo.init()]);
  const entries=[];let previous="0".repeat(64);
  for(let i=1;i<=500;i++){
   const m={empresaId,sedeId,id:id(i),operacionId:id(1000+i),tipo:"CREDITO",montoCentavos:1,antesCentavos:i-1,despuesCentavos:i,secuencia:i,actorId,ip:"127.0.0.1",timestamp:new Date("2026-10-14T00:00:00Z"),hashAnterior:previous,deletedAt:null};
   m.hash=hashAsiento(m);previous=m.hash;entries.push(m);
  }
  await Movimiento.insertMany(entries,{ordered:true});
  await Saldo.create({empresaId,sedeId,secuencia:500,saldoCentavos:500,hashUltimo:previous});
  const started=performance.now();
  const audits=await Promise.all(Array.from({length:8},()=>auditarLedgerEnMongo({empresaId,sedeId,maxAsientos:500})));
  const elapsed=performance.now()-started;
  for(const audit of audits){
   assert.equal(audit.ok,true);
   assert.equal(audit.secuencia,500);
   assert.equal(audit.saldoCentavos,500);
   assert.equal(audit.hashUltimo,previous);
  }
  t.diagnostic("mongo_auditorias_concurrentes_n=8_asientos=500_lote_ms="+elapsed.toFixed(2));
 }finally{await mongoose.connection.dropDatabase();await mongoose.disconnect();}
});
