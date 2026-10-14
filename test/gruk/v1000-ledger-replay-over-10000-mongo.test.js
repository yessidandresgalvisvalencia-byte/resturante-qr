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
  // Simular modificación privilegiada de un asiento intermedio sin recomponer
  // los hashes posteriores. El replay debe fallar, nunca confirmar el pago.
  await Movimiento.collection.updateOne({empresaId,sedeId,secuencia:5000},
   {$set:{montoCentavos:9}});
  await assert.rejects(
   ()=>registrarMovimiento({empresaId,sedeId,actorId,ip,tipo:"CREDITO",
    montoCentavos:1,operacionId:id(40001)}),
   /LEDGER_REPLAY_CADENA_INVALIDA/
  );
  assert.equal(await Movimiento.countDocuments({empresaId,sedeId}),cantidad);
  assert.equal((await Saldo.findOne({empresaId,sedeId}).lean()).saldoCentavos,cantidad);
  // Restaurar el asiento y confirmar que el rechazo anterior no fue causado
  // por el tamaño del historial ni por un efecto secundario del replay.
  await Movimiento.collection.updateOne({empresaId,sedeId,secuencia:5000},
   {$set:{montoCentavos:1}});
  const recuperado=await registrarMovimiento({empresaId,sedeId,actorId,ip,
   tipo:"CREDITO",montoCentavos:1,operacionId:id(40001)});
  assert.equal(recuperado.secuencia,1);
  assert.equal(await Movimiento.countDocuments({empresaId,sedeId}),cantidad);
  assert.equal((await Saldo.findOne({empresaId,sedeId}).lean()).saldoCentavos,cantidad);
  // La eliminación directa de un asiento intermedio tampoco puede pasar
  // inadvertida durante la conciliación de un replay histórico.
  await Movimiento.collection.deleteOne({empresaId,sedeId,secuencia:5000});
  await assert.rejects(
   ()=>registrarMovimiento({empresaId,sedeId,actorId,ip,tipo:"CREDITO",
    montoCentavos:1,operacionId:id(40001)}),
   /LEDGER_REPLAY_CADENA_INVALIDA/
  );
  assert.equal(await Movimiento.countDocuments({empresaId,sedeId}),cantidad-1);
  assert.equal((await Saldo.findOne({empresaId,sedeId}).lean()).saldoCentavos,cantidad);
  // Reconstruir el asiento eliminado para probar luego una escritura válida.
  const original=docs[4999];
  await Movimiento.collection.insertOne({...original});
  // Si un asiento antiguo cambia pero la cabecera y el último siguen intactos,
  // la comprobación local de la cola no detecta por sí sola la corrupción.
  await Movimiento.collection.updateOne({empresaId,sedeId,secuencia:5000},
   {$set:{montoCentavos:9}});
  await assert.rejects(
   ()=>auditarLedgerEnMongo({empresaId,sedeId,maxAsientos:cantidad}),
   /LEDGER_AUDITORIA_INCONSISTENTE/
  );
  // No dar por íntegra una cadena solo por comparar el último hash.
  assert.equal((await Saldo.findOne({empresaId,sedeId}).lean()).hashUltimo,anterior);
  await Movimiento.collection.updateOne({empresaId,sedeId,secuencia:5000},
   {$set:{montoCentavos:1}});
 }finally{await mongoose.connection.dropDatabase();await mongoose.disconnect();}
});
