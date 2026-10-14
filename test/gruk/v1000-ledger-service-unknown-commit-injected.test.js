"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const mongoose=require("mongoose");
const Movimiento=require("../../models/MovimientoLedgerV1000");
const Saldo=require("../../models/SaldoLedgerV1000");
const {registrarMovimiento}=require("../../services/ledgerV1000.service");
const base={empresaId:"01ARZ3NDEKTSV4RRFFQ69G5FAV",sedeId:"01ARZ3NDEKTSV4RRFFQ69G5FAW",actorId:"01ARZ3NDEKTSV4RRFFQ69G5FAX",ip:"127.0.0.1",tipo:"CREDITO",montoCentavos:125};
function injectUnknownCommit(mode){
 const start=mongoose.startSession;
 let calls=0;
 mongoose.startSession=async function(...args){
  const session=await start.apply(this,args);
  calls++;
  if(calls===2){
   const withTransaction=session.withTransaction.bind(session);
   session.withTransaction=async function(callback,opts){
    if(mode==="committed")await withTransaction(callback,opts);
    const e=new Error("simulated uncertain commit");
    e.hasErrorLabel=label=>label==="UnknownTransactionCommitResult";
    throw e;
   };
  }
  return session;
 };
 return ()=>{mongoose.startSession=start;};
}
test("V1000: fallo de confirmación inyectado se concilia sin duplicar, o queda indeterminado",async t=>{
 if(!process.env.TEST_MONGO_URI){t.skip("Mongo replica set requerido");return;}
 await mongoose.connect(process.env.TEST_MONGO_URI,{dbName:"gruk_test_v1000_unknown_commit_injected",serverSelectionTimeoutMS:5000});
 try{
  await Promise.all([Movimiento.init(),Saldo.init()]);
  const a={...base,operacionId:"01ARZ3NDEKTSV4RRFFQ69G5FAY"};
  let restore=injectUnknownCommit("committed");
  try{
   const result=await registrarMovimiento(a);
   assert.equal(result.montoCentavos,125);
   assert.equal(result.secuencia,1);
  }finally{restore();}
  assert.equal(await Movimiento.countDocuments({empresaId:base.empresaId,sedeId:base.sedeId}),1);
  let head=await Saldo.findOne({empresaId:base.empresaId,sedeId:base.sedeId}).lean();
  assert.equal(head.saldoCentavos,125);
  restore=injectUnknownCommit("not-committed");
  try{
   await assert.rejects(registrarMovimiento({...base,operacionId:"01ARZ3NDEKTSV4RRFFQ69G5FAZ"}),/LEDGER_CONFIRMACION_INDETERMINADA/);
  }finally{restore();}
  assert.equal(await Movimiento.countDocuments({empresaId:base.empresaId,sedeId:base.sedeId}),1);
  head=await Saldo.findOne({empresaId:base.empresaId,sedeId:base.sedeId}).lean();
  assert.equal(head.saldoCentavos,125);
  assert.equal(head.secuencia,1);
 }finally{await mongoose.connection.dropDatabase();await mongoose.disconnect();}
});
