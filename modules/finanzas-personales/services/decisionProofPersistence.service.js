"use strict";
const mongoose=require("mongoose");const crypto=require("crypto");
const DecisionProof=require("../models/decisionProofPersonal.model");
const Outbox=require("../models/outboxPersonal.model");
const ChainHead=require("../models/decisionChainHeadPersonal.model");
const proof=require("./decisionProof.service");
async function registrar(usuarioId,args){
 if(!usuarioId)throw new TypeError("usuarioId obligatorio");
 if(typeof args?.idempotencyKey!=="string"||args.idempotencyKey.trim().length<8)throw new TypeError("idempotencyKey inválida");
 const existente=await DecisionProof.findOne({usuarioId,idempotencyKey:args.idempotencyKey.trim()}).lean();
 if(existente)return existente;
 const session=await mongoose.startSession();let guardada=null;
 try{await session.withTransaction(async()=>{
  const repetida=await DecisionProof.findOne({usuarioId,idempotencyKey:args.idempotencyKey.trim()}).session(session).lean();
  if(repetida){guardada=repetida;return;}
  let head=await ChainHead.findOne({usuarioId}).session(session);
  if(!head){try{const hs=await ChainHead.create([{usuarioId,headHash:null,secuencia:0}],{session});head=hs[0];}catch(e){if(e?.code!==11000)throw e;head=await ChainHead.findOne({usuarioId}).session(session);}}
  const previousHash=head.headHash||null;
  const secuencia=head.secuencia+1;
  const creada=proof.crear({...args,version:2,previousHash,secuencia});
  const docs=await DecisionProof.create([{usuarioId,...creada}],{session});
  head.headHash=creada.hash;head.secuencia=secuencia;await head.save({session});
  guardada=docs[0].toObject();
  await Outbox.create([{usuarioId,eventId:crypto.randomUUID(),eventName:"DECISION_PROOF_REGISTRADA",aggregateType:"DECISION_PROOF",aggregateId:docs[0]._id,payload:{decisionProofId:String(docs[0]._id),hash:creada.hash,accion:creada.accion,autorizada:creada.autorizada}}],{session});
 },{readConcern:{level:"snapshot"},writeConcern:{w:"majority"},readPreference:"primary"});
 return guardada;
 }catch(err){
  if(err?.code===11000){const recuperada=await DecisionProof.findOne({usuarioId,idempotencyKey:args.idempotencyKey.trim()}).lean();if(recuperada)return recuperada;}
  throw err;
 }finally{await session.endSession();}
}
module.exports={registrar};
