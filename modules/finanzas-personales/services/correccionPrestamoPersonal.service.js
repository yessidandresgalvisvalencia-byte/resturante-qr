"use strict";
const mongoose=require("mongoose"),crypto=require("node:crypto"),Joi=require("joi");
const P=require("../models/prestamoPersonal.model"),E=require("../models/correccionPrestamoPersonal.model"),O=require("../models/outboxPersonal.model");
const {indiceExacto}=require("../security/auditoriaIndicesMongoV81.service");
const MAX=1000,GENESIS="0".repeat(64),falla=(m,c=409)=>Object.assign(new Error(m),{statusCode:c});
const esquema=Joi.object({contraparte:Joi.string().trim().min(1).max(140),concepto:Joi.string().trim().min(1).max(160),origenCuentaPorCobrar:Joi.string().valid("PRESTAMO","TRABAJO","OTRO"),principalMinor:Joi.number().integer().min(1).max(Number.MAX_SAFE_INTEGER),cuotaMinor:Joi.number().integer().min(0).max(Number.MAX_SAFE_INTEGER),tasaMensualPct:Joi.number().min(0).max(100),fechaVencimiento:Joi.date().allow(null),numeroCuotas:Joi.number().integer().min(1).max(360),periodicidad:Joi.string().valid("UNICA","SEMANAL","QUINCENAL","MENSUAL"),diaPago:Joi.number().integer().min(1).max(31),periodicidadConfirmada:Joi.boolean()}).min(1);
function canon(v){if(v instanceof Date)return v.toISOString();if(v instanceof mongoose.Types.ObjectId)return String(v);if(v===null||typeof v!=="object")return v;if(Array.isArray(v))return v.map(canon);return Object.fromEntries(Object.keys(v).sort().map(k=>[k,canon(v[k])]));}
const igual=(a,b)=>JSON.stringify(canon(a))===JSON.stringify(canon(b));
const digest=v=>crypto.createHash("sha256").update(JSON.stringify(canon(v))).digest("hex");
function foto(p){return canon(Object.fromEntries(Object.entries(p).filter(([k])=>!["_id","usuarioId","__v","createdAt","updatedAt","retiroRevision","retiroHash","correccionRevision","correccionHash"].includes(k))));}
function hash(e){return digest(Object.fromEntries(["usuarioId","prestamoId","secuencia","solicitudId","solicitudHash","cambios","anterior","posterior","fecha","hashAnterior"].map(k=>[k,e[k]])));}
function verificar(eventos,p){
 let prev=GENESIS;if(eventos.length>MAX)throw falla("Historial de correcciones supera capacidad verificable");
 for(let i=0;i<eventos.length;i++){const e=eventos[i];if(String(e.usuarioId)!==String(p.usuarioId)||String(e.prestamoId)!==String(p._id)||e.secuencia!==i+1||e.hashAnterior!==prev||e.hashActual!==hash(e)||e.solicitudHash!==digest(e.cambios))throw falla("Historial de correcciones no verificable");prev=e.hashActual;}
 if((p.correccionRevision||0)!==eventos.length||(p.correccionHash||GENESIS)!==prev)throw falla("Cursor de correcciones no verificable");return eventos.at(-1);
}
async function exigirIndices(){let indices;try{indices=await E.collection.indexes();}catch{throw falla("Índices de corrección no disponibles",503);}
 if(!indiceExacto(indices,["usuarioId","prestamoId","secuencia"])||!indiceExacto(indices,["usuarioId","solicitudId"]))throw falla("Índices de corrección no verificados",503);
}
function validar(u,id,c,s){
 if(!mongoose.isValidObjectId(u)||!mongoose.isValidObjectId(id)||s?.confirmacion!==true||typeof s.solicitudId!=="string"||!/^[A-Za-z0-9_-]{8,100}$/.test(s.solicitudId))throw falla("Confirma la corrección y conserva su identificador de reintento",400);
 const {error,value}=esquema.validate(c,{convert:false});if(error)throw falla("Cambios de préstamo inválidos",422);return value;
}
async function corregir(usuarioId,prestamoId,cambios,solicitud,aplicar){
 const c=validar(usuarioId,prestamoId,cambios,solicitud),solicitudHash=digest(c);await exigirIndices();
 const session=await mongoose.startSession();let resultado;
 try{await session.withTransaction(async()=>{
  const raw=await P.findOne({_id:prestamoId,usuarioId}).session(session).lean();if(!raw)throw falla("Préstamo no encontrado",404);
  const eventos=await E.find({usuarioId,prestamoId}).sort({secuencia:1}).limit(MAX+1).maxTimeMS(5000).session(session).lean(),ultimo=verificar(eventos,raw);
  const replay=await E.findOne({usuarioId,solicitudId:solicitud.solicitudId}).session(session).lean();
  if(replay){if(String(replay.prestamoId)!==String(prestamoId)||replay.solicitudHash!==solicitudHash)throw falla("Identificador de corrección usado con otros datos");resultado={...raw,correccion:{hash:replay.hashActual,duplicado:true,vigente:ultimo?.hashActual===replay.hashActual&&igual(foto(raw),replay.posterior)}};return;}
  if(eventos.length>=MAX)throw falla("Historial de correcciones supera capacidad verificable");
  if(!Number.isSafeInteger(raw.principalMinor)||raw.principalMinor<=0||!Number.isSafeInteger(raw.saldoMinor)||raw.saldoMinor<0||raw.saldoMinor>raw.principalMinor||!Number.isSafeInteger(raw.cuotaMinor)||raw.cuotaMinor<0)throw falla("Importes originales requieren revisión",422);
  const p=P.hydrate(raw),anterior=foto(raw),auditoria=await aplicar(usuarioId,p,c,session);
  await p.save({session});const guardada=await P.findOne({_id:p._id,usuarioId}).session(session).lean();
  const e={usuarioId:p.usuarioId,prestamoId:p._id,secuencia:eventos.length+1,solicitudId:solicitud.solicitudId,solicitudHash,cambios:canon(c),anterior,posterior:foto(guardada),fecha:new Date(),hashAnterior:ultimo?.hashActual||GENESIS};e.hashActual=hash(e);await E.create([e],{session});
  const cambio=await P.updateOne({_id:p._id,usuarioId},{$set:{correccionRevision:e.secuencia,correccionHash:e.hashActual}},{session});if(cambio.matchedCount!==1)throw falla("Préstamo cambió durante corrección");
  await O.create([{usuarioId,eventId:crypto.randomUUID(),eventName:"PRESTAMO_PERSONAL_CORREGIDO",aggregateType:"PRESTAMO_PERSONAL",aggregateId:p._id,payload:{...auditoria,correccionHash:e.hashActual}}],{session});
  resultado={...guardada,correccionRevision:e.secuencia,correccionHash:e.hashActual,correccion:{hash:e.hashActual,duplicado:false,vigente:true}};
 },{readConcern:{level:"snapshot"},writeConcern:{w:"majority"},readPreference:"primary"});return resultado;}finally{await session.endSession();}
}
async function historial(usuarioId,prestamoId){
 if(!mongoose.isValidObjectId(usuarioId)||!mongoose.isValidObjectId(prestamoId))throw falla("Identificador inválido",400);
 const session=await mongoose.startSession();let resultado;
 try{await session.withTransaction(async()=>{const p=await P.findOne({_id:prestamoId,usuarioId}).session(session).lean();if(!p)throw falla("Préstamo no encontrado",404);
 const eventos=await E.find({usuarioId,prestamoId}).sort({secuencia:1}).limit(MAX+1).maxTimeMS(5000).session(session).lean();verificar(eventos,p);resultado={eventos,alcance:"CORRECCIONES_REGISTRADAS",certificaHistoriaCompleta:false};
 },{readConcern:{level:"snapshot"},readPreference:"primary"});return resultado;}finally{await session.endSession();}
}
module.exports={foto,digest,hash,verificar,validar,exigirIndices,corregir,historial};
