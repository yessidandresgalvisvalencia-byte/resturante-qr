"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const mongoose=require("mongoose");
const Saldo=require("../../models/SaldoLedgerV1000");

test("Ledger V1000: validadores de update ACID rechazan saldo inseguro sin modificar cabecera",async t=>{
 if(!process.env.TEST_MONGO_URI){t.skip("Requiere MongoDB replica set");return;}
 const connection=await mongoose.createConnection(process.env.TEST_MONGO_URI,{
  dbName:"gruk_test_v1000_head_update_validators",serverSelectionTimeoutMS:5000
 }).asPromise();
 const Model=connection.model("SaldoLedgerV1000",Saldo.schema);
 const empresaId="01ARZ3NDEKTSV4RRFFQ69G5FAV",sedeId="01ARZ3NDEKTSV4RRFFQ69G5FAW";
 const session=await connection.startSession();
 try{
  await Model.init();
  await Model.create({empresaId,sedeId});
  for(const [campo,valor] of [["saldoCentavos",1.5],["saldoCentavos",-1],["saldoCentavos",Number.MAX_SAFE_INTEGER+1],["hashUltimo","invalido"]]){
   await assert.rejects(session.withTransaction(async()=>{
    await Model.updateOne({empresaId,sedeId},{$set:{[campo]:valor}},{session,runValidators:true});
   }),/LEDGER_SALDO_INVALIDO|LEDGER_HASH_INVALIDO/);
  }
  const row=await Model.findOne({empresaId,sedeId}).lean();
  assert.equal(row.saldoCentavos,0);
  assert.equal(row.secuencia,0);
  assert.equal(row.hashUltimo,"0".repeat(64));
 }finally{
  await session.endSession();
  await connection.dropDatabase();
  await connection.close();
 }
});
