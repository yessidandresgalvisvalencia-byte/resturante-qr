"use strict";
const mongoose=require("mongoose"),crypto=require("node:crypto"),R=require("../models/reciboCreacionInversionPersonal.model"),C=require("../models/InversionPatrimonial"),L=require("../models/inversion.model"),{indiceExacto}=require("../security/auditoriaIndicesMongoV81.service");
const falla=(m,c=409)=>Object.assign(new Error(m),{statusCode:c});
function canon(v){if(v instanceof Date)return v.toISOString();if(v instanceof mongoose.Types.ObjectId)return String(v);if(v===null||typeof v!=="object")return v;if(Array.isArray(v))return v.map(canon);return Object.fromEntries(Object.keys(v).sort().map(k=>[k,canon(v[k])]));}
const digest=v=>crypto.createHash("sha256").update(JSON.stringify(canon(v))).digest("hex");
const normalizarNombre=v=>v.normalize("NFKC").trim().replace(/\s+/g," ").toUpperCase();
const huellaSolicitud=solicitud=>digest({metodo:"POST",path:"/inversiones",cuerpo:solicitud});
const hash=r=>digest(Object.fromEntries(["usuarioId","secuencia","hashAnterior","solicitudId","solicitudHuella","inversionId","legacyId","nombreClave","solicitud","original","legacyOriginal","fecha"].map(k=>[k,r[k]])));
function validarIdentidad(u,k){if(!mongoose.isValidObjectId(u)||typeof k!=="string"||!/^inversion_[A-Za-z0-9_-]{8,80}$/.test(k))throw falla("Identidad estable de inversión inválida",400);}
function validarSolicitud(s){
 const campos=["confirmacion","nombre","clase","capitalAportado","valorActual","moneda","liquidezDias","riesgoDeclarado","institucion","fechaValor"];
 if(!s||typeof s!=="object"||Array.isArray(s)||s.confirmacion!==true||Object.keys(s).some(k=>!campos.includes(k)))throw falla("Confirma explícitamente los datos de la inversión",400);
 if(typeof s.nombre!=="string"||s.nombre.length>140||/[\u0000-\u001f\u007f]/.test(s.nombre)||!normalizarNombre(s.nombre)||normalizarNombre(s.nombre).length>140||s.institucion!==undefined&&(typeof s.institucion!=="string"||s.institucion.length>120||/[\u0000-\u001f\u007f]/.test(s.institucion)))throw falla("Revisa nombre e institución de la inversión",422);
 if(!["EFECTIVO_RENTABLE","RENTA_FIJA","RENTA_VARIABLE","FONDO","ETF","CRIPTO","INMOBILIARIA","OTRA"].includes(s.clase)||s.moneda!=="COP")throw falla("La inversión requiere una clase conocida y moneda COP explícita",422);
 if(!Number.isSafeInteger(s.capitalAportado)||s.capitalAportado<0||!Number.isSafeInteger(s.valorActual)||s.valorActual<0)throw falla("Indica capital y valor declarados como enteros exactos no negativos",422);
 if(s.liquidezDias!==null&&(!Number.isSafeInteger(s.liquidezDias)||s.liquidezDias<0||s.liquidezDias>3650)||!["BAJO","MEDIO","ALTO","NO_CLASIFICADO"].includes(s.riesgoDeclarado))throw falla("Declara liquidez entre 0 y 3650 días o desconocida, y riesgo conocido o no clasificado",422);
 if(typeof s.fechaValor!=="string"||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(s.fechaValor)||!Number.isFinite(+new Date(s.fechaValor))||new Date(s.fechaValor).toISOString()!==s.fechaValor||+new Date(s.fechaValor)>Date.now())throw falla("Indica la fecha válida y no futura del valor declarado",422);
 return{nombre:normalizarNombre(s.nombre),clase:s.clase,capitalAportadoMinor:s.capitalAportado,valorActualMinor:s.valorActual,moneda:"COP",liquidezDias:s.liquidezDias,riesgoDeclarado:s.riesgoDeclarado,institucion:s.institucion?.trim()||"",fechaValorDeclarado:new Date(s.fechaValor),origenValor:"DECLARACION_USUARIO"};
}
async function exigirIndices(){let indices;try{indices=await R.collection.indexes();}catch{throw falla("Índices de recibos de inversiones no disponibles",503);}if(![["usuarioId","secuencia"],["usuarioId","solicitudId"],["usuarioId","inversionId"],["usuarioId","nombreClave"]].every(k=>indiceExacto(indices,k)))throw falla("Índices de recibos de inversiones no verificados",503);}
const oid=v=>new mongoose.Types.ObjectId(String(v));
function foto(x){const r=canon(x);delete r.creacionReciboHash;delete r.cicloInversionRevision;delete r.cicloInversionHash;return r;}
function verificar(r){
 validarIdentidad(r?.usuarioId,r?.solicitudId);
 if(!Number.isSafeInteger(r.secuencia)||r.secuencia<1||!/^[a-f0-9]{64}$/.test(r.hashAnterior||"")||r.hashActual!==hash(r)||r.solicitudHuella!==huellaSolicitud(r.solicitud)||String(r.original?._id)!==String(r.inversionId)||String(r.original?.usuarioId)!==String(r.usuarioId)||String(r.original?.legacyId)!==String(r.legacyId)||String(r.legacyOriginal?._id)!==String(r.legacyId)||String(r.legacyOriginal?.userId)!==String(r.usuarioId)||r.original?.creacionSolicitudId!==r.solicitudId||r.legacyOriginal?.creacionSolicitudId!==r.solicitudId)throw falla("Recibo de inversión no verificable");
 const d=canon(validarSolicitud(r.solicitud));if(r.nombreClave!==d.nombre||Object.entries(d).some(([k,v])=>JSON.stringify(r.original[k])!==JSON.stringify(v)))throw falla("La inversión original no corresponde a la declaración");
 const legado={nombre:d.nombre,clase:d.clase,capitalAportado:d.capitalAportadoMinor,valorActual:d.valorActualMinor,moneda:d.moneda,liquidezDias:d.liquidezDias,riesgoDeclarado:d.riesgoDeclarado,institucion:d.institucion,fechaValorDeclarado:d.fechaValorDeclarado,origenValor:d.origenValor};if(Object.entries(legado).some(([k,v])=>JSON.stringify(r.legacyOriginal[k])!==JSON.stringify(v)))throw falla("La fuente previa no corresponde a la declaración");return r;
}
function verificarPareja(r,c,l){verificar(r);if(!c||!l||c.creacionReciboHash!==r.hashActual||digest(foto(c))!==digest(r.original)||digest(canon(l))!==digest(r.legacyOriginal))throw falla("Las fuentes de la inversión requieren revisión; no se confirmará ni duplicará su creación");return r;}
async function verificarFuentes(r,session){const c=await C.collection.findOne({_id:oid(r.inversionId),usuarioId:oid(r.usuarioId)},{session,maxTimeMS:5000}),l=await L.collection.findOne({_id:oid(r.legacyId),userId:oid(r.usuarioId)},{session,maxTimeMS:5000});return verificarPareja(r,c,l);}
function resumen(r){return{confirmado:true,solicitudId:r.solicitudId,solicitudHuella:r.solicitudHuella,inversionId:String(r.inversionId),hash:r.hashActual,ruta:"/inversiones",metodo:"POST",certificaEstadoActual:false};}
const resultado=(r,duplicado)=>({inversion:r.original,recibo:resumen(r),duplicado});
const buscar=(u,k,session)=>R.findOne({usuarioId:u,solicitudId:k}).session(session).maxTimeMS(5000).lean();
async function crear(usuarioId,solicitudId,solicitud){
 validarIdentidad(usuarioId,solicitudId);const datos=validarSolicitud(solicitud),huella=huellaSolicitud(solicitud);await exigirIndices();const session=await mongoose.startSession();let salida;
 try{await session.withTransaction(async()=>{
  const previo=await buscar(usuarioId,solicitudId,session);if(!previo)await require("./proteccionOriginalCompensadoPersonal.service").serializarEscrituraFuente(usuarioId,session);
  const inversiones=await C.find({usuarioId}).limit(501).maxTimeMS(5000).session(session).lean(),legados=await L.find({userId:usuarioId}).limit(501).maxTimeMS(5000).session(session).lean();
  const continuidad=await verificarInversiones(usuarioId,inversiones,{session,legados});
  if(previo){if(previo.solicitudHuella!==huella)throw falla("La clave de la inversión ya identifica otros datos");await verificarFuentes(previo,session);salida=resultado(previo,true);return;}
  if(inversiones.length>=500||legados.length>=500)throw falla("Demasiadas inversiones para revisar identidad; requiere revisión",503);
  require("./lecturaInversionesPersonal.service").calcular(usuarioId,legados,inversiones,{retirados:continuidad.retirados});
  if([...inversiones,...legados].some(c=>typeof c.nombre!=="string"||normalizarNombre(c.nombre)===datos.nombre))throw falla("Ya hay una inversión con ese nombre. Revisa la original antes de registrar otra; usa nombres distintos para posiciones distintas");
  const [legacy]=await L.create([{userId:usuarioId,nombre:datos.nombre,clase:datos.clase,capitalAportado:datos.capitalAportadoMinor,valorActual:datos.valorActualMinor,moneda:datos.moneda,liquidezDias:datos.liquidezDias,riesgoDeclarado:datos.riesgoDeclarado,institucion:datos.institucion,fechaValorDeclarado:datos.fechaValorDeclarado,origenValor:datos.origenValor,creacionSolicitudId:solicitudId}],{session});
  const [inversion]=await C.create([{usuarioId,legacyId:legacy._id,...datos,creacionSolicitudId:solicitudId}],{session});
  const original=await C.collection.findOne({_id:inversion._id,usuarioId:oid(usuarioId)},{session}),legacyOriginal=await L.collection.findOne({_id:legacy._id,userId:oid(usuarioId)},{session});
  const r={usuarioId,secuencia:continuidad.secuencia,hashAnterior:continuidad.hashAnterior,solicitudId,solicitudHuella:huella,inversionId:inversion._id,legacyId:legacy._id,nombreClave:datos.nombre,solicitud:canon(solicitud),original:foto(original),legacyOriginal:canon(legacyOriginal),fecha:new Date()};r.hashActual=hash(r);verificar(r);await R.create([r],{session});
  const cursor=await C.updateOne({_id:inversion._id,usuarioId,creacionSolicitudId:solicitudId,creacionReciboHash:{$exists:false}},{$set:{creacionReciboHash:r.hashActual}},{session,timestamps:false,runValidators:true});if(cursor.matchedCount!==1)throw falla("No se confirmó la referencia de creación de la inversión");await verificarFuentes(r,session);require("./lecturaInversionesPersonal.service").calcular(usuarioId,[...legados,legacyOriginal],[...inversiones,original],{retirados:continuidad.retirados});salida=resultado(r,false);
 },{readConcern:{level:"snapshot"},writeConcern:{w:"majority"},readPreference:"primary"});return salida;
 }catch(e){if(e.code===11000)throw falla("Conflicto de identidad o concurrencia; consulta el recibo y revisa tus inversiones antes de reintentar con la misma clave y datos");throw e;}finally{await session.endSession();}
}
async function consultar(usuarioId,solicitudId){validarIdentidad(usuarioId,solicitudId);await exigirIndices();const session=await mongoose.startSession();let salida;try{await session.withTransaction(async()=>{const r=await buscar(usuarioId,solicitudId,session);if(!r)throw falla("No hay recibo verificable de esa inversión; continúa sin confirmar",404);const inversiones=await C.find({usuarioId}).limit(501).maxTimeMS(5000).session(session).lean();await verificarInversiones(usuarioId,inversiones,{session});await verificarFuentes(r,session);salida=resumen(r);},{readConcern:{level:"snapshot"},readPreference:"primary"});return salida;}finally{await session.endSession();}}
async function verificarInversiones(usuarioId,inversiones,{session,legados}={}){
 if(!session?.inTransaction())throw falla("La verificación de inversiones requiere lectura consistente",503);await exigirIndices();
 const recibos=await R.find({usuarioId}).sort({secuencia:1}).limit(501).maxTimeMS(5000).session(session).lean();legados??=await L.find({userId:usuarioId}).limit(501).maxTimeMS(5000).session(session).lean();
 if(!Array.isArray(inversiones)||inversiones.length>500||legados.length>500||recibos.length>500)throw falla("Demasiadas inversiones para verificar fuentes",503);
 const cs=new Map(inversiones.map(x=>[String(x._id),x])),ls=new Map(legados.map(x=>[String(x._id),x])),rs=new Map(recibos.map(x=>[x.solicitudId,x]));
 if(cs.size!==inversiones.length||ls.size!==legados.length||rs.size!==recibos.length)throw falla("Identidad duplicada de inversiones");
 let anterior="0".repeat(64),secuencia=0;for(const r of recibos){if(r.secuencia!==++secuencia||r.hashAnterior!==anterior)throw falla("Cadena de declaraciones de inversiones incompleta o alterada");verificarPareja(r,cs.get(String(r.inversionId)),ls.get(String(r.legacyId)));anterior=r.hashActual;}
 for(const c of inversiones)if(c.creacionSolicitudId!==undefined||c.creacionReciboHash!==undefined){const r=rs.get(c.creacionSolicitudId);if(!r||String(r.inversionId)!==String(c._id)||r.hashActual!==c.creacionReciboHash)throw falla("Falta evidencia de creación de la inversión");}
 for(const l of legados)if(l.creacionSolicitudId!==undefined){const r=rs.get(l.creacionSolicitudId);if(!r||String(r.legacyId)!==String(l._id))throw falla("Falta evidencia de la fuente original de la inversión");}
 const retirados=await require("./cicloInversionPersonal.service").verificarInversiones(usuarioId,inversiones,{session});return{secuencia:secuencia+1,hashAnterior:anterior,retirados};
}
module.exports={crear,consultar,exigirIndices,validarIdentidad,validarSolicitud,normalizarNombre,huellaSolicitud,hash,verificar,verificarInversiones,resumen};
