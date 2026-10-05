"use strict";
const mongoose=require("mongoose");const crypto=require("crypto");
const DecisionProof=require("../models/decisionProofPersonal.model");
const Outbox=require("../models/outboxPersonal.model");
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
  const anterior=await DecisionProof.findOne({usuarioId}).sort({corte:-1,_id:-1}).session(session).lean();
  const creada=proof.crear(args);
  const docs=await DecisionProof.create([{usuarioId,...creada,previousHash:anterior?.hash||null}],{session});
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
