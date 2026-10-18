"use strict";
const mongoose=require("mongoose");const crypto=require("crypto");
const DecisionProof=require("../models/decisionProofPersonal.model");
const Outbox=require("../models/outboxPersonal.model");
const ChainHead=require("../models/decisionChainHeadPersonal.model");
const proof=require("./decisionProof.service");
function fingerprint(args){const payload={accion:String(args?.accion||"").trim(),evaluacion:args?.evaluacion||null,verdades:args?.verdades||[],actorId:args?.actorId?String(args.actorId):null};return crypto.createHash("sha256").update(JSON.stringify(proof.canonical(payload))).digest("hex");}
function resolverExistente(doc,fp){if(!doc)return null;if(doc.requestFingerprint&&doc.requestFingerprint!==fp){const e=new Error("IDEMPOTENCY_KEY_CONFLICT");e.code="IDEMPOTENCY_KEY_CONFLICT";throw e;}return doc;}
function esConflictoTransitorio(error) {
 return Boolean(error?.hasErrorLabel?.("TransientTransactionError") || error?.code === 112 || error?.codeName === "WriteConflict");
}
async function registrar(usuarioId,args){
 if(!usuarioId)throw new TypeError("usuarioId obligatorio");
 if(typeof args?.idempotencyKey!=="string"||args.idempotencyKey.trim().length<8)throw new TypeError("idempotencyKey inválida");
 const fp=fingerprint(args);
 const existente=await DecisionProof.findOne({usuarioId,idempotencyKey:args.idempotencyKey.trim()}).lean();
 if(existente)return resolverExistente(existente,fp);
 const clave=args.idempotencyKey.trim();
 // La inicialización se hace fuera de la transacción; una creación simultánea
 // puede devolver E11000 aun cuando la otra solicitud haya creado el head.
 try {
  await ChainHead.updateOne({usuarioId},{$setOnInsert:{usuarioId,headHash:null,secuencia:0}},{upsert:true});
 } catch (error) {
  if(error?.code!==11000 || !await ChainHead.exists({usuarioId}))throw error;
 }
 // Releer tras un conflicto: la escritura previa pudo haberse confirmado.
 for(let intento=0;intento<5;intento+=1){
  const confirmada=await DecisionProof.findOne({usuarioId,idempotencyKey:clave}).lean();
  if(confirmada)return resolverExistente(confirmada,fp);
  const session=await mongoose.startSession();
  try {
   return await session.withTransaction(async()=>{
    const repetida=await DecisionProof.findOne({usuarioId,idempotencyKey:clave}).session(session).lean();
    if(repetida)return resolverExistente(repetida,fp);
    const head=await ChainHead.findOne({usuarioId}).session(session);
    if(!head)throw new Error("CHAIN_HEAD_AUSENTE");
    const previousHash=head.headHash||null;
    const secuencia=head.secuencia+1;
    const creada=proof.crear({...args,idempotencyKey:clave,version:2,previousHash,secuencia});
    const docs=await DecisionProof.create([{usuarioId,...creada,requestFingerprint:fp}],{session});
    head.headHash=creada.hash;head.secuencia=secuencia;await head.save({session});
    await Outbox.create([{usuarioId,eventId:crypto.randomUUID(),eventName:"DECISION_PROOF_REGISTRADA",aggregateType:"DECISION_PROOF",aggregateId:docs[0]._id,payload:{decisionProofId:String(docs[0]._id),hash:creada.hash,accion:creada.accion,autorizada:creada.autorizada}}],{session});
    return docs[0].toObject();
   },{readConcern:{level:"snapshot"},writeConcern:{w:"majority"},readPreference:"primary"});
  } catch(error){
   if(error?.code===11000){
    const recuperada=await DecisionProof.findOne({usuarioId,idempotencyKey:clave}).lean();
    if(recuperada)return resolverExistente(recuperada,fp);
   }
   if(intento===4 || !esConflictoTransitorio(error))throw error;
  } finally {await session.endSession();}
 }
 throw new Error("DECISION_PROOF_RETRY_EXHAUSTED");
}
module.exports={fingerprint,resolverExistente,esConflictoTransitorio,registrar};
