"use strict";
const mongoose=require("mongoose"),crypto=require("node:crypto"),Joi=require("joi");
const P=require("../models/prestamoPersonal.model"),E=require("../models/correccionPrestamoPersonal.model"),O=require("../models/outboxPersonal.model");
const {indiceExacto}=require("../security/auditoriaIndicesMongoV81.service");
const Aud=require("../security/contextoAuditoriaCorreccionPrestamoPersonal.service");
const MAX=1000,GENESIS="0".repeat(64),falla=(m,c=409)=>Object.assign(new Error(m),{statusCode:c});
const esquema=Joi.object({versionOrigen:Joi.string().pattern(/^[a-f0-9]{64}$/),revisarCobrosTrabajo:Joi.boolean().valid(true),contraparte:Joi.string().trim().min(1).max(140),concepto:Joi.string().trim().min(1).max(160),origenCuentaPorCobrar:Joi.string().valid("PRESTAMO","TRABAJO","OTRO"),principalMinor:Joi.number().integer().min(1).max(Number.MAX_SAFE_INTEGER),cuotaMinor:Joi.number().integer().min(0).max(Number.MAX_SAFE_INTEGER),tasaMensualPct:Joi.number().min(0).max(100),fechaVencimiento:Joi.date().allow(null),numeroCuotas:Joi.number().integer().min(1).max(360),periodicidad:Joi.string().valid("UNICA","SEMANAL","QUINCENAL","MENSUAL"),diaPago:Joi.number().integer().min(1).max(31),periodicidadConfirmada:Joi.boolean()}).min(1);
function canon(v){if(v instanceof Date)return v.toISOString();if(v instanceof mongoose.Types.ObjectId)return String(v);if(v===null||typeof v!=="object")return v;if(Array.isArray(v))return v.map(canon);return Object.fromEntries(Object.keys(v).sort().map(k=>[k,canon(v[k])]));}
const igual=(a,b)=>JSON.stringify(canon(a))===JSON.stringify(canon(b));
const digest=v=>crypto.createHash("sha256").update(JSON.stringify(canon(v))).digest("hex");
function foto(p){return canon(Object.fromEntries(Object.entries(p).filter(([k])=>!["resolucionRetiroRevision","resolucionRetiroHash","_id","usuarioId","__v","createdAt","updatedAt","retiroRevision","retiroHash","correccionRevision","correccionHash","imputacionRevision","imputacionHash"].includes(k))));}
function hash(e){return digest({...Object.fromEntries(["usuarioId","prestamoId","secuencia","solicitudId","solicitudHash","cambios","anterior","posterior","fecha","hashAnterior",...(Object.hasOwn(e,"noAplicada")?["noAplicada","motivoNoAplicada"]:[])].map(k=>[k,e[k]])),...Aud.enlace(e)});}
function verificarContexto(e){Aud.validarDocumento(e,e.usuarioId);if(e.auditoriaContexto!==undefined&&(!(e.fecha instanceof Date)||!Number.isFinite(+e.fecha)||+e.fecha>Date.now()||Date.parse(e.auditoriaContexto.capturadoEn)>+e.fecha))throw falla("Fecha de contexto de corrección no verificable");}
function verificarCierre(e){
 if(!Object.hasOwn(e,"noAplicada")&&!Object.hasOwn(e,"motivoNoAplicada"))return;
 if(e.noAplicada!==true||e.motivoNoAplicada!=="CIERRE_EXPLICITO_PROPIETARIO"||!igual(e.anterior,e.posterior)||e.anterior?.direccion!=="POR_COBRAR"||!Number.isSafeInteger(e.anterior.principalMinor)||e.anterior.principalMinor<1||!Number.isSafeInteger(e.anterior.saldoMinor)||e.anterior.saldoMinor<0||e.anterior.saldoMinor>e.anterior.principalMinor)throw falla("Cierre de revisión no verificable");
 const c=validar(e.usuarioId,e.prestamoId,e.cambios,{confirmacion:true,solicitudId:e.solicitudId});
 if(c.revisarCobrosTrabajo!==true)throw falla("Cierre de otro contrato");
}
function verificar(eventos,p){
 let prev=GENESIS;if(eventos.length>MAX)throw falla("Historial de correcciones supera capacidad verificable");
 for(let i=0;i<eventos.length;i++){const e=eventos[i];if(String(e.usuarioId)!==String(p.usuarioId)||String(e.prestamoId)!==String(p._id)||e.secuencia!==i+1||e.hashAnterior!==prev||e.hashActual!==hash(e)||e.solicitudHash!==digest(e.cambios))throw falla("Historial de correcciones no verificable");verificarCierre(e);verificarContexto(e);prev=e.hashActual;}
 if((p.correccionRevision||0)!==eventos.length||(p.correccionHash||GENESIS)!==prev)throw falla("Cursor de correcciones no verificable");return eventos.at(-1);
}
async function exigirIndices(){let indices;try{indices=await E.collection.indexes();}catch{throw falla("Índices de corrección no disponibles",503);}
 if(!indiceExacto(indices,["usuarioId","prestamoId","secuencia"])||!indiceExacto(indices,["usuarioId","solicitudId"]))throw falla("Índices de corrección no verificados",503);
}
function validar(u,id,c,s){
 if(!mongoose.isValidObjectId(u)||!mongoose.isValidObjectId(id)||s?.confirmacion!==true||typeof s.solicitudId!=="string"||!/^[A-Za-z0-9_-]{8,100}$/.test(s.solicitudId))throw falla("Confirma la corrección y conserva su identificador de reintento",400);
 const {error,value}=esquema.validate(c,{convert:false});if(error)throw falla("Cambios de préstamo inválidos",422);if(value.versionOrigen!==undefined&&(!value.origenCuentaPorCobrar||Object.keys(value).some(k=>!(value.revisarCobrosTrabajo===true?["origenCuentaPorCobrar","versionOrigen","revisarCobrosTrabajo"]:["origenCuentaPorCobrar","versionOrigen"]).includes(k))))throw falla("Selección de origen inválida",422);if(value.revisarCobrosTrabajo===true&&(value.origenCuentaPorCobrar!=="TRABAJO"||Object.keys(value).some(k=>!["origenCuentaPorCobrar","revisarCobrosTrabajo","versionOrigen"].includes(k))))throw falla("Revisión de cobros inválida",422);return value;
}
// Se conserva validar() para verificar/reintentar eventos históricos con su cuerpo original.
function exigirVersionOrigenNueva(c){if(Object.hasOwn(c,"origenCuentaPorCobrar")&&c.versionOrigen===undefined)throw Object.assign(falla("Confirma el origen por separado desde Confirmar origen, con la selección vigente. Conserva la solicitud histórica si estás consultando una corrección anterior",422),{code:"ORIGEN_REQUIERE_VERSION"});}
async function corregir(usuarioId,prestamoId,cambios,solicitud,aplicar,cerrarSinAplicar=false,opciones={}){
 const c=validar(usuarioId,prestamoId,cambios,solicitud),solicitudHash=digest(c),capturar=Aud.resolver(usuarioId,opciones);if(cerrarSinAplicar&&c.revisarCobrosTrabajo!==true)throw falla("Cierre de otro contrato",400);await exigirIndices();
 const session=await mongoose.startSession();let resultado;
 try{await session.withTransaction(async()=>{
  const raw=await P.findOne({_id:prestamoId,usuarioId}).session(session).lean();if(!raw)throw falla("Préstamo no encontrado",404);
  const eventos=await E.find({usuarioId,prestamoId}).select("+auditoriaContexto").sort({secuencia:1}).limit(MAX+1).maxTimeMS(5000).session(session).lean(),ultimo=verificar(eventos,raw);
  if(ultimo&&ultimo.posterior?.origenCuentaPorCobrar!==raw.origenCuentaPorCobrar)throw falla("Origen actual no coincide con la última corrección auditada; requiere revisión sin reparar automáticamente");
  const replay=await E.findOne({usuarioId,solicitudId:solicitud.solicitudId}).select("+auditoriaContexto").session(session).lean();
  if(replay){if(String(replay.prestamoId)!==String(prestamoId)||replay.solicitudHash!==solicitudHash)throw falla("Identificador de corrección usado con otros datos");if(replay.noAplicada&&!cerrarSinAplicar)throw Object.assign(falla("La solicitud fue cerrada sin aplicar. Consulta su recibo; no cambies la clave para reenviarla"),{code:"REVISION_CERRADA_SIN_APLICAR"});resultado={...raw,correccion:{...(replay.noAplicada?{noAplicada:true}:{}),hash:replay.hashActual,duplicado:true,vigente:ultimo?.hashActual===replay.hashActual&&igual(foto(raw),foto(replay.posterior))}};return;}
  if(cerrarSinAplicar){
   if(raw.direccion!=="POR_COBRAR")throw falla("Cuenta por cobrar no encontrada",404);
   if(eventos.length>=MAX)throw falla("Historial de correcciones supera capacidad verificable");
   await require("./seleccionOrigenCobroPersonal.service").enSesion(usuarioId,raw,eventos,session);
   const auditoriaContexto=capturar();await require("./proteccionOriginalCompensadoPersonal.service").serializarEscrituraFuente(usuarioId,session);
   const e={auditoriaContexto,usuarioId:raw.usuarioId,prestamoId:raw._id,secuencia:eventos.length+1,solicitudId:solicitud.solicitudId,solicitudHash,cambios:canon(c),anterior:foto(raw),posterior:foto(raw),fecha:new Date(),hashAnterior:ultimo?.hashActual||GENESIS,noAplicada:true,motivoNoAplicada:"CIERRE_EXPLICITO_PROPIETARIO"};
   e.hashActual=hash(e);verificarCierre(e);verificarContexto(e);await E.create([e],{session});
   const cambio=await P.updateOne({_id:raw._id,usuarioId},{$set:{correccionRevision:e.secuencia,correccionHash:e.hashActual}},{session,timestamps:false});if(cambio.matchedCount!==1)throw falla("Préstamo cambió durante cierre");
   await O.create([{usuarioId,eventId:crypto.randomUUID(),eventName:"REVISION_ORIGEN_PERSONAL_CERRADA_SIN_APLICAR",aggregateType:"PRESTAMO_PERSONAL",aggregateId:raw._id,payload:{prestamoId:String(raw._id),solicitudId:solicitud.solicitudId,correccionHash:e.hashActual,afectaCaja:false}}],{session});
   resultado={...raw,correccionRevision:e.secuencia,correccionHash:e.hashActual,correccion:{hash:e.hashActual,duplicado:false,vigente:true,noAplicada:true}};return;
  }
  exigirVersionOrigenNueva(c);
  if(c.versionOrigen!==undefined){
   if(c.versionOrigen!==await require("./seleccionOrigenCobroPersonal.service").enSesion(usuarioId,raw,eventos,session))throw falla("La cuenta, sus correcciones o cobros cambiaron. Consulta de nuevo antes de confirmar el origen");
  }
  if(eventos.length>=MAX)throw falla("Historial de correcciones supera capacidad verificable");
  if(!Number.isSafeInteger(raw.principalMinor)||raw.principalMinor<=0||!Number.isSafeInteger(raw.saldoMinor)||raw.saldoMinor<0||raw.saldoMinor>raw.principalMinor||!Number.isSafeInteger(raw.cuotaMinor)||raw.cuotaMinor<0)throw falla("Importes originales requieren revisión",422);
  const auditoriaContexto=capturar();if(c.versionOrigen!==undefined)await require("./proteccionOriginalCompensadoPersonal.service").serializarEscrituraFuente(usuarioId,session);
  const p=P.hydrate(raw);if(!Object.hasOwn(raw,"origenCuentaPorCobrar"))p.set("origenCuentaPorCobrar",undefined);const anterior=foto(raw),auditoria=await aplicar(usuarioId,p,c,session);
  await p.save({session});const guardada=await P.findOne({_id:p._id,usuarioId}).session(session).lean();
  const e={auditoriaContexto,usuarioId:p.usuarioId,prestamoId:p._id,secuencia:eventos.length+1,solicitudId:solicitud.solicitudId,solicitudHash,cambios:canon(c),anterior,posterior:foto(guardada),fecha:new Date(),hashAnterior:ultimo?.hashActual||GENESIS};e.hashActual=hash(e);verificarContexto(e);await E.create([e],{session});
  const cambio=await P.updateOne({_id:p._id,usuarioId},{$set:{correccionRevision:e.secuencia,correccionHash:e.hashActual}},{session});if(cambio.matchedCount!==1)throw falla("Préstamo cambió durante corrección");
  await O.create([{usuarioId,eventId:crypto.randomUUID(),eventName:"PRESTAMO_PERSONAL_CORREGIDO",aggregateType:"PRESTAMO_PERSONAL",aggregateId:p._id,payload:{...auditoria,correccionHash:e.hashActual}}],{session});
  resultado={...guardada,correccionRevision:e.secuencia,correccionHash:e.hashActual,correccion:{hash:e.hashActual,duplicado:false,vigente:true}};
 },{readConcern:{level:"snapshot"},writeConcern:{w:"majority"},readPreference:"primary"});return resultado;}finally{await session.endSession();}
}
async function historial(usuarioId,prestamoId){
 if(!mongoose.isValidObjectId(usuarioId)||!mongoose.isValidObjectId(prestamoId))throw falla("Identificador inválido",400);
 const session=await mongoose.startSession();let resultado;
 try{await session.withTransaction(async()=>{const p=await P.findOne({_id:prestamoId,usuarioId}).session(session).lean();if(!p)throw falla("Préstamo no encontrado",404);
 const eventos=await E.find({usuarioId,prestamoId}).select("+auditoriaContexto").sort({secuencia:1}).limit(MAX+1).maxTimeMS(5000).session(session).lean();verificar(eventos,p);resultado={eventos:eventos.map(e=>Aud.visible(e)),alcance:"CORRECCIONES_REGISTRADAS",certificaHistoriaCompleta:false};
 },{readConcern:{level:"snapshot"},readPreference:"primary"});return resultado;}finally{await session.endSession();}
}
module.exports={Aud,verificarContexto,verificarCierre,exigirVersionOrigenNueva,foto,digest,hash,verificar,validar,exigirIndices,corregir,historial};
