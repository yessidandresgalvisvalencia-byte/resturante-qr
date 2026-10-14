"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {MongoClient}=require("mongodb");
const {verificarCadena,hashAsiento}=require("../../core/finance/v1000/auditarLedger");
test("V1000: auditoría rechaza cadena incompleta y aísla empresas y sedes",async t=>{
 if(!process.env.TEST_MONGO_URI){t.skip("Requiere réplica MongoDB");return;}
 const client=new MongoClient(process.env.TEST_MONGO_URI,{serverSelectionTimeoutMS:5000});
 await client.connect();
 const db=client.db("gruk_test_v1000_audit_tenants");
 const m=db.collection("movimientos"),h=db.collection("cabeceras");
 const empresaId="01ARZ3NDEKTSV4RRFFQ69G5FAV",sedeId="01ARZ3NDEKTSV4RRFFQ69G5FAW";
 const otro="01ARZ3NDEKTSV4RRFFQ69G5FB0";
 try{
  const a={empresaId,sedeId,id:"01ARZ3NDEKTSV4RRFFQ69G5FAX",operacionId:"01ARZ3NDEKTSV4RRFFQ69G5FAY",tipo:"CREDITO",montoCentavos:100,antesCentavos:0,despuesCentavos:100,secuencia:1,actorId:"01ARZ3NDEKTSV4RRFFQ69G5FAZ",ip:"127.0.0.1",timestamp:new Date("2026-10-14T00:00:00Z"),hashAnterior:"0".repeat(64),deletedAt:null};
  a.hash=hashAsiento(a);
  const b={...a,id:"01ARZ3NDEKTSV4RRFFQ69G5FB1",operacionId:"01ARZ3NDEKTSV4RRFFQ69G5FB2",secuencia:2,tipo:"DEBITO",montoCentavos:1,antesCentavos:100,despuesCentavos:99,hashAnterior:a.hash};
  b.hash=hashAsiento(b);
  await m.insertMany([a,b,{...a,empresaId:otro,id:"01ARZ3NDEKTSV4RRFFQ69G5FB3",operacionId:"01ARZ3NDEKTSV4RRFFQ69G5FB4"}]);
  await h.insertOne({empresaId,sedeId,secuencia:2,saldoCentavos:99,hashUltimo:b.hash});
  const session=client.startSession();
  try{
   const audit=async()=>session.withTransaction(async()=>{
    const head=await h.findOne({empresaId,sedeId},{session});
    const asientos=await m.find({empresaId,sedeId},{session}).sort({secuencia:1}).toArray();
    return verificarCadena({empresaId,sedeId,asientos,cabecera:head});
   },{readConcern:{level:"snapshot"}});
   assert.equal((await audit()).saldoCentavos,99);
   await m.deleteOne({id:b.id});
   await assert.rejects(audit(),/LEDGER_AUDITORIA_CABECERA_DIVERGENTE/);
  }finally{await session.endSession();}
 }finally{await db.dropDatabase();await client.close();}
});
