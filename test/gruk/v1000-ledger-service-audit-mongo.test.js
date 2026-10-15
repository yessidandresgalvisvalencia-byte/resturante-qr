"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const mongoose=require("mongoose");
const Movimiento=require("../../models/MovimientoLedgerV1000");
const Saldo=require("../../models/SaldoLedgerV1000");
const {hashAsiento}=require("../../core/finance/v1000/auditarLedger");
const {auditarLedgerEnMongo}=require("../../services/auditarLedgerV1000.service");
const empresaId="01ARZ3NDEKTSV4RRFFQ69G5FAV";
const sedeId="01ARZ3NDEKTSV4RRFFQ69G5FAW";
const otraEmpresa="01ARZ3NDEKTSV4RRFFQ69G5FB0";
test("Servicio V1000 audita Mongo real con snapshot, aislamiento y detección de truncamiento",async t=>{
 if(!process.env.TEST_MONGO_URI){t.skip("Replica set requerido");return;}
 await mongoose.connect(process.env.TEST_MONGO_URI,{dbName:"gruk_test_v1000_auditoria_servicio",serverSelectionTimeoutMS:5000});
 try{
  await Promise.all([Movimiento.init(),Saldo.init()]);
  const a={empresaId,sedeId,id:"01ARZ3NDEKTSV4RRFFQ69G5FAX",operacionId:"01ARZ3NDEKTSV4RRFFQ69G5FAY",tipo:"CREDITO",montoCentavos:100,antesCentavos:0,despuesCentavos:100,secuencia:1,actorId:"01ARZ3NDEKTSV4RRFFQ69G5FAZ",ip:"127.0.0.1",timestamp:new Date("2026-10-14T00:00:00Z"),hashAnterior:"0".repeat(64),deletedAt:null};
  a.hash=hashAsiento(a);
  const b={...a,id:"01ARZ3NDEKTSV4RRFFQ69G5FB1",operacionId:"01ARZ3NDEKTSV4RRFFQ69G5FB2",tipo:"DEBITO",montoCentavos:1,antesCentavos:100,despuesCentavos:99,secuencia:2,hashAnterior:a.hash};
  b.hash=hashAsiento(b);
  const tercero={...a,empresaId:otraEmpresa,id:"01ARZ3NDEKTSV4RRFFQ69G5FB3",operacionId:"01ARZ3NDEKTSV4RRFFQ69G5FB4"};
  tercero.hash=hashAsiento(tercero);
  await Movimiento.create([a,b,tercero]);
  await Saldo.create([{empresaId,sedeId,secuencia:2,saldoCentavos:99,hashUltimo:b.hash},{empresaId:otraEmpresa,sedeId,secuencia:1,saldoCentavos:100,hashUltimo:tercero.hash}]);
  assert.equal((await auditarLedgerEnMongo({empresaId,sedeId})).saldoCentavos,99);
  assert.equal((await auditarLedgerEnMongo({empresaId:otraEmpresa,sedeId})).saldoCentavos,100);
  await assert.rejects(auditarLedgerEnMongo({empresaId,sedeId,maxAsientos:1}),/LEDGER_AUDITORIA_REQUIERE_PARTICION/);
  // Simulate a compromised DB account bypassing model middleware.
  await Movimiento.collection.deleteOne({empresaId,sedeId,secuencia:2});
  await assert.rejects(auditarLedgerEnMongo({empresaId,sedeId}),/LEDGER_AUDITORIA_CABECERA_DIVERGENTE/);
 }finally{
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
 }
});
