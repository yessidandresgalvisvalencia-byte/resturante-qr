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
function id(n){
 let suffix="";
 for(let i=0;i<16;i++){suffix=ABC[n%32]+suffix;n=Math.floor(n/32);}
 return "01ARZ3NDEK"+suffix;
}
test("V1000: medir el servicio auditor contra MongoDB con 1000 asientos",async t=>{
 if(!process.env.TEST_MONGO_URI){t.skip("MongoDB replica set requerido");return;}
 await mongoose.connect(process.env.TEST_MONGO_URI,{dbName:"gruk_test_v1000_audit_service_perf",serverSelectionTimeoutMS:5000});
 const empresaId=id(10001),sedeId=id(10002),actorId=id(10003);
 try{
  await Promise.all([Movimiento.init(),Saldo.init()]);
  const rows=[];
  let previous="0".repeat(64);
  for(let i=1;i<=1000;i++){
   const m={id:id(i),operacionId:id(i+2000),empresaId,sedeId,tipo:"CREDITO",montoCentavos:1,antesCentavos:i-1,despuesCentavos:i,secuencia:i,actorId,ip:"127.0.0.1",timestamp:new Date("2026-10-14T00:00:00Z"),hashAnterior:previous,deletedAt:null};
   m.hash=hashAsiento(m);previous=m.hash;rows.push(m);
  }
  await Movimiento.insertMany(rows,{ordered:true});
  await Saldo.create({empresaId,sedeId,secuencia:1000,saldoCentavos:1000,hashUltimo:previous});
  // Warm up the driver and query plan before collecting repeatable samples.
  const warm=await auditarLedgerEnMongo({empresaId,sedeId,maxAsientos:1000});
  assert.equal(warm.saldoCentavos,1000);
  const times=[];
  for(let i=0;i<20;i++){
   const start=performance.now();
   const result=await auditarLedgerEnMongo({empresaId,sedeId,maxAsientos:1000});
   times.push(performance.now()-start);
   assert.equal(result.ok,true);
   assert.equal(result.saldoCentavos,1000);
   assert.equal(result.secuencia,1000);
  }
  const sorted=[...times].sort((a,b)=>a-b);
  const percentile=p=>sorted[Math.ceil(p*sorted.length)-1].toFixed(2);
  t.diagnostic("mongo_auditoria_1000_n=20_p50_ms="+percentile(0.5)+
    "_p95_ms="+percentile(0.95)+"_p99_ms="+percentile(0.99));
 }finally{await mongoose.connection.dropDatabase();await mongoose.disconnect();}
});
