"use strict";
const test=require("node:test");const assert=require("node:assert/strict");const mongoose=require("mongoose");const crypto=require("crypto");
const registrar=require("../../modules/finanzas-personales/services/decisionProofPersistence.service").registrar;
const Proof=require("../../modules/finanzas-personales/models/decisionProofPersonal.model");
const Head=require("../../modules/finanzas-personales/models/decisionChainHeadPersonal.model");
const Outbox=require("../../modules/finanzas-personales/models/outboxPersonal.model");

test("DecisionProof serializa dos escrituras concurrentes sin huérfanos",{skip:!process.env.TEST_MONGO_URI},async()=>{
 await mongoose.connect(process.env.TEST_MONGO_URI,{dbName:"gruk_chain_concurrency"});
 try{
  await Promise.all([Proof.deleteMany({}),Head.deleteMany({}),Outbox.deleteMany({})]);
  await Promise.all([Proof.syncIndexes(),Head.syncIndexes(),Outbox.syncIndexes()]);
  const usuarioId=new mongoose.Types.ObjectId();
  const base={evaluacion:{autorizada:false,irreversible:false,motivos:[]},verdades:[],actorId:"TEST"};
  const [a,b]=await Promise.all([
   registrar(usuarioId,{...base,accion:"CONSULTAR",idempotencyKey:"race-key-0001"}),
   registrar(usuarioId,{...base,accion:"SIMULAR",idempotencyKey:"race-key-0002"})
  ]);
  assert.notEqual(a.hash,b.hash);
  const items=await Proof.find({usuarioId}).sort({secuencia:1}).lean();
  assert.deepEqual(items.map(x=>x.secuencia),[1,2]);
  assert.equal(items[0].previousHash,null);
  assert.equal(items[1].previousHash,items[0].hash);
  const head=await Head.findOne({usuarioId}).lean();
  assert.equal(head.secuencia,2);assert.equal(head.headHash,items[1].hash);
  const outbox=await Outbox.find({usuarioId,eventName:"DECISION_PROOF_REGISTRADA"}).lean();
  assert.equal(outbox.length,2);
  assert.deepEqual(new Set(outbox.map(x=>String(x.aggregateId))).size,2);
 }finally{await mongoose.disconnect();}
});
