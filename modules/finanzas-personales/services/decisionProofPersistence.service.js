"use strict";
const mongoose=require("mongoose");const crypto=require("crypto");
const DecisionProof=require("../models/decisionProofPersonal.model");
const Outbox=require("../models/outboxPersonal.model");
const ChainHead=require("../models/decisionChainHeadPersonal.model");
const proof=require("./decisionProof.service");
function fingerprint(args){
 const payload={
  accion:String(args?.accion||"").trim(),
  evaluacion:args?.evaluacion||null,
  verdades:args?.verdades||[],
  actorId:args?.actorId?String(args.actorId):null
 };
 // La fecha explícita cambia la semántica de una solicitud y debe firmarse.
 // Omitirla conserva la idempotencia cuando el servidor fija el instante.
 if(args?.corte!==undefined){
  const corte=new Date(args.corte);
  if(Number.isNaN(corte.getTime()))throw new TypeError("Fecha de corte inválida");
  payload.corte=corte.toISOString();
 }
 return crypto.createHash("sha256").update(JSON.stringify(proof.canonical(payload))).digest("hex");
}
function resolverExistente(doc,fp){
 if(!doc)return null;
 // Los registros sin huella no pueden verificarse: bloquear su reutilización
 // en lugar de entregar una decisión que podría corresponder a otra solicitud.
 if(!doc.requestFingerprint){
  const error=new Error("IDEMPOTENCY_FINGERPRINT_MISSING");
  error.code="IDEMPOTENCY_FINGERPRINT_MISSING";
  throw error;
 }
 if(doc.requestFingerprint!==fp){
  const error=new Error("IDEMPOTENCY_KEY_CONFLICT");
  error.code="IDEMPOTENCY_KEY_CONFLICT";
  throw error;
 }
 return doc;
}
function esConflictoTransitorio(error) {
 // Commit incierto: releer primero idempotencyKey antes de volver a escribir.
 return Boolean(error?.hasErrorLabel?.("TransientTransactionError") ||
  error?.hasErrorLabel?.("UnknownTransactionCommitResult") ||
  error?.code === 112 || error?.codeName === "WriteConflict");
}
function esColisionSecuencia(error) {
 // Nunca reintentar indiscriminadamente E11000: una clave idempotente
 // duplicada debe resolverse por fingerprint, no creando otro registro.
 return Boolean(error?.code===11000 &&
  error?.keyPattern?.usuarioId===1 && error?.keyPattern?.secuencia===1 &&
  Object.keys(error.keyPattern).length===2);
}
function errorAgotamientoConcurrenciaV81(error){
 const recuperable=esConflictoTransitorio(error)||esColisionSecuencia(error);
 if(!recuperable)return error;
 const fallo=new Error("DECISION_PROOF_CONCURRENCY_RETRY_EXHAUSTED");
 fallo.code="DECISION_PROOF_CONCURRENCY_RETRY_EXHAUSTED";
 fallo.statusCode=503;
 return fallo;
}
function validarClaveDecisionProofV81(valor){
 if(typeof valor!=="string")throw new TypeError("idempotencyKey inválida");
 const clave=valor.trim();
 if(!(/^[\x21-\x7e]{8,128}$/.test(clave)))
  throw new TypeError("idempotencyKey inválida");
 return clave;
}
async function registrar(usuarioId,args){
 if(!(usuarioId instanceof mongoose.Types.ObjectId) &&
    !(typeof usuarioId==="string"&&/^[a-f0-9]{24}$/i.test(usuarioId)))
  throw new TypeError("usuarioId MongoDB inválido");
 const clave=validarClaveDecisionProofV81(args?.idempotencyKey);
 const fp=fingerprint(args);
 const existente=await DecisionProof.findOne({usuarioId,idempotencyKey:clave}).lean();
 if(existente)return resolverExistente(existente,fp);
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
   if(intento===4)throw errorAgotamientoConcurrenciaV81(error);
   if(!(esConflictoTransitorio(error)||esColisionSecuencia(error)))throw error;
  } finally {await session.endSession();}
 }
 throw new Error("DECISION_PROOF_RETRY_EXHAUSTED");
}
module.exports={errorAgotamientoConcurrenciaV81,validarClaveDecisionProofV81,fingerprint,resolverExistente,esConflictoTransitorio,esColisionSecuencia,registrar};
