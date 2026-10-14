"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const mongoose=require("mongoose");
const Movimiento=require("../../models/MovimientoLedgerV1000");
const Saldo=require("../../models/SaldoLedgerV1000");
const {hashAsiento}=require("../../core/finance/v1000/auditarLedger");
const {registrarMovimiento}=require("../../services/ledgerV1000.service");
const {auditarLedgerEnMongo}=require("../../services/auditarLedgerV1000.service");
const ABC="0123456789ABCDEFGHJKMNPQRSTVWXYZ";
function id(n){let s="";for(let i=0;i<16;i++){s=ABC[n%32]+s;n=Math.floor(n/32);}return "01ARZ3NDEK"+s;}
test("V1000: replay real de operación histórica tras 10001 asientos conserva saldo y no duplica",async t=>{
 if(!process.env.TEST_MONGO_URI){t.skip("Replica set MongoDB requerido");return;}
 await mongoose.connect(process.env.TEST_MONGO_URI,{dbName:"gruk_test_v1000_replay_over_10000",serverSelectionTimeoutMS:5000});
 const empresaId=id(30001),sedeId=id(30002),actorId=id(30003),ip="127.0.0.1";
 const cantidad=10001;
 try{
  await Promise.all([Movimiento.init(),Saldo.init()]);
  let anterior="0".repeat(64);
  const docs=[];
  for(let n=1;n<=cantidad;n++){
   const m={id:id(n),operacionId:id(n+40000),empresaId,sedeId,tipo:"CREDITO",
    montoCentavos:1,antesCentavos:n-1,despuesCentavos:n,secuencia:n,
    actorId,ip,timestamp:new Date("2026-10-14T00:00:00Z"),hashAnterior:anterior,deletedAt:null};
   m.hash=hashAsiento(m);anterior=m.hash;docs.push(m);
  }
  await Movimiento.insertMany(docs,{ordered:true});
  await Saldo.create({empresaId,sedeId,saldoCentavos:cantidad,secuencia:cantidad,hashUltimo:anterior});
  const audit=await auditarLedgerEnMongo({empresaId,sedeId,maxAsientos:cantidad});
  assert.equal(audit.ok,true);
  assert.equal(audit.saldoCentavos,cantidad);
  const replay=await registrarMovimiento({empresaId,sedeId,actorId,ip,tipo:"CREDITO",
   montoCentavos:1,operacionId:id(40001)});
  assert.equal(replay.secuencia,1);
  assert.equal(replay.despuesCentavos,1);
  assert.equal(await Movimiento.countDocuments({empresaId,sedeId}),cantidad);
  assert.equal((await Saldo.findOne({empresaId,sedeId}).lean()).saldoCentavos,cantidad);
 }finally{await mongoose.connection.dropDatabase();await mongoose.disconnect();}
});
