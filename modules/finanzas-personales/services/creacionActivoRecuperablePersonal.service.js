"use strict";
const mongoose=require("mongoose"),crypto=require("node:crypto"),R=require("../models/reciboCreacionActivoPersonal.model"),C=require("../models/ActivoPatrimonial"),L=require("../models/activo.model"),{indiceExacto}=require("../security/auditoriaIndicesMongoV81.service");
const falla=(m,c=409)=>Object.assign(new Error(m),{statusCode:c});
function canon(v){if(v instanceof Date)return v.toISOString();if(v instanceof mongoose.Types.ObjectId)return String(v);if(v===null||typeof v!=="object")return v;if(Array.isArray(v))return v.map(canon);return Object.fromEntries(Object.keys(v).sort().map(k=>[k,canon(v[k])]));}
const digest=v=>crypto.createHash("sha256").update(JSON.stringify(canon(v))).digest("hex");
const normalizarNombre=v=>v.normalize("NFKC").trim().replace(/\s+/g," ").toUpperCase();
const huellaSolicitud=solicitud=>digest({metodo:"POST",path:"/activos",cuerpo:solicitud});
const hash=r=>digest(Object.fromEntries(["usuarioId","solicitudId","solicitudHuella","activoId","legacyId","nombreClave","solicitud","original","legacyOriginal","fecha"].map(k=>[k,r[k]])));
function validarIdentidad(u,k){if(!mongoose.isValidObjectId(u)||typeof k!=="string"||!/^activo_[A-Za-z0-9_-]{8,80}$/.test(k))throw falla("Identidad estable de activo inválida",400);}
function validarSolicitud(s){
 const campos=["confirmacion","nombre","tipo","valorActual","moneda","liquido","institucion","fechaValor"];
 if(!s||typeof s!=="object"||Array.isArray(s)||s.confirmacion!==true||Object.keys(s).some(k=>!campos.includes(k)))throw falla("Confirma explícitamente los datos del activo",400);
 if(typeof s.nombre!=="string"||s.nombre.length>120||/[\u0000-\u001f\u007f]/.test(s.nombre)||!normalizarNombre(s.nombre)||normalizarNombre(s.nombre).length>120||s.institucion!==undefined&&(typeof s.institucion!=="string"||s.institucion.length>120||/[\u0000-\u001f\u007f]/.test(s.institucion)))throw falla("Revisa nombre e institución del activo",422);
 if(!["INMUEBLE","VEHICULO","OTRO"].includes(s.tipo)||s.moneda!=="COP"||s.liquido!==false)throw falla("Registra aquí un activo no líquido en COP. El efectivo y las cuentas van en cuentas de caja; las inversiones en inversiones",422);
 if(!Number.isSafeInteger(s.valorActual)||s.valorActual<0)throw falla("Indica un valor declarado entero exacto no negativo",422);
 if(typeof s.fechaValor!=="string"||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(s.fechaValor)||!Number.isFinite(+new Date(s.fechaValor))||new Date(s.fechaValor).toISOString()!==s.fechaValor||+new Date(s.fechaValor)>Date.now())throw falla("Indica la fecha válida y no futura del valor declarado",422);
 return{nombre:normalizarNombre(s.nombre),tipo:s.tipo,valorMinor:s.valorActual,moneda:"COP",liquido:false,institucion:s.institucion?.trim()||"",fechaValorDeclarado:new Date(s.fechaValor),origenValor:"DECLARACION_USUARIO"};
}
async function exigirIndices(){let indices;try{indices=await R.collection.indexes();}catch{throw falla("Índices de recibos de activos no disponibles",503);}if(![["usuarioId","solicitudId"],["usuarioId","activoId"],["usuarioId","nombreClave"]].every(k=>indiceExacto(indices,k)))throw falla("Índices de recibos de activos no verificados",503);}
const oid=v=>new mongoose.Types.ObjectId(String(v));
function foto(x){const r=canon(x);delete r.creacionReciboHash;return r;}
function verificar(r){
 validarIdentidad(r?.usuarioId,r?.solicitudId);
 if(r.hashActual!==hash(r)||r.solicitudHuella!==huellaSolicitud(r.solicitud)||String(r.original?._id)!==String(r.activoId)||String(r.original?.usuarioId)!==String(r.usuarioId)||String(r.original?.legacyId)!==String(r.legacyId)||String(r.legacyOriginal?._id)!==String(r.legacyId)||String(r.legacyOriginal?.userId)!==String(r.usuarioId)||r.original?.creacionSolicitudId!==r.solicitudId||r.legacyOriginal?.creacionSolicitudId!==r.solicitudId)throw falla("Recibo de activo no verificable");
 const d=canon(validarSolicitud(r.solicitud));if(r.nombreClave!==d.nombre||Object.entries(d).some(([k,v])=>JSON.stringify(r.original[k])!==JSON.stringify(v)))throw falla("El activo original no corresponde a la declaración");
 const legado={nombre:d.nombre,tipo:d.tipo,valorActual:d.valorMinor,liquido:false,institucion:d.institucion,fechaValorDeclarado:d.fechaValorDeclarado,origenValor:d.origenValor};if(Object.entries(legado).some(([k,v])=>JSON.stringify(r.legacyOriginal[k])!==JSON.stringify(v)))throw falla("La fuente previa no corresponde a la declaración");return r;
}
function verificarPareja(r,c,l){verificar(r);if(!c||!l||c.creacionReciboHash!==r.hashActual||digest(foto(c))!==digest(r.original)||digest(canon(l))!==digest(r.legacyOriginal))throw falla("Las fuentes del activo requieren revisión; no se confirmará ni duplicará su creación");return r;}
async function verificarFuentes(r,session){const c=await C.collection.findOne({_id:oid(r.activoId),usuarioId:oid(r.usuarioId)},{session,maxTimeMS:5000}),l=await L.collection.findOne({_id:oid(r.legacyId),userId:oid(r.usuarioId)},{session,maxTimeMS:5000});return verificarPareja(r,c,l);}
function resumen(r){return{confirmado:true,solicitudId:r.solicitudId,solicitudHuella:r.solicitudHuella,activoId:String(r.activoId),hash:r.hashActual,ruta:"/activos",metodo:"POST",certificaEstadoActual:false};}
const resultado=(r,duplicado)=>({activo:r.original,recibo:resumen(r),duplicado});
const buscar=(u,k,session)=>R.findOne({usuarioId:u,solicitudId:k}).session(session).maxTimeMS(5000).lean();
async function crear(usuarioId,solicitudId,solicitud){
 validarIdentidad(usuarioId,solicitudId);const datos=validarSolicitud(solicitud),huella=huellaSolicitud(solicitud);await exigirIndices();const session=await mongoose.startSession();let salida;
 try{await session.withTransaction(async()=>{
  const previo=await buscar(usuarioId,solicitudId,session);if(previo){await verificarActivos(usuarioId,await C.find({usuarioId}).limit(501).maxTimeMS(5000).session(session).lean(),{session});if(previo.solicitudHuella!==huella)throw falla("La clave del activo ya identifica otros datos");await verificarFuentes(previo,session);salida=resultado(previo,true);return;}
  await require("./proteccionOriginalCompensadoPersonal.service").serializarEscrituraFuente(usuarioId,session);
  const activos=await C.find({usuarioId}).limit(501).maxTimeMS(5000).session(session).lean(),legados=await L.find({userId:usuarioId}).limit(501).maxTimeMS(5000).session(session).lean();
  if(activos.length>=500||legados.length>=500)throw falla("Demasiados activos para revisar identidad; requiere revisión",503);
  const revision=await verificarActivos(usuarioId,activos,{session,legados});require("./lecturaActivosPersonal.service").sumar([revision.activosNoLiquidosMinor,datos.valorMinor]);
  if([...activos,...legados].some(c=>typeof c.nombre!=="string"||normalizarNombre(c.nombre)===datos.nombre))throw falla("Ya hay un activo con ese nombre. Revisa el original antes de registrar otro; usa nombres distintos para bienes distintos");
  const [legacy]=await L.create([{userId:usuarioId,nombre:datos.nombre,tipo:datos.tipo,valorActual:datos.valorMinor,liquido:false,institucion:datos.institucion,fechaValorDeclarado:datos.fechaValorDeclarado,origenValor:datos.origenValor,creacionSolicitudId:solicitudId}],{session});
  const [activo]=await C.create([{usuarioId,legacyId:legacy._id,...datos,creacionSolicitudId:solicitudId}],{session});
  const original=await C.collection.findOne({_id:activo._id,usuarioId:oid(usuarioId)},{session}),legacyOriginal=await L.collection.findOne({_id:legacy._id,userId:oid(usuarioId)},{session});
  const r={usuarioId,solicitudId,solicitudHuella:huella,activoId:activo._id,legacyId:legacy._id,nombreClave:datos.nombre,solicitud:canon(solicitud),original:foto(original),legacyOriginal:canon(legacyOriginal),fecha:new Date()};r.hashActual=hash(r);verificar(r);await R.create([r],{session});
  const cursor=await C.updateOne({_id:activo._id,usuarioId,creacionSolicitudId:solicitudId,creacionReciboHash:{$exists:false}},{$set:{creacionReciboHash:r.hashActual}},{session,timestamps:false,runValidators:true});if(cursor.matchedCount!==1)throw falla("No se confirmó la referencia de creación del activo");await verificarFuentes(r,session);require("./lecturaActivosPersonal.service").calcular(usuarioId,[...legados,legacyOriginal],[...activos,original]);salida=resultado(r,false);
 },{readConcern:{level:"snapshot"},writeConcern:{w:"majority"},readPreference:"primary"});return salida;
 }catch(e){if(e.code===11000)throw falla("Activo o solicitud ya registrada; consulta el recibo antes de repetir");throw e;}finally{await session.endSession();}
}
async function consultar(usuarioId,solicitudId){validarIdentidad(usuarioId,solicitudId);await exigirIndices();const session=await mongoose.startSession();let salida;try{await session.withTransaction(async()=>{const r=await buscar(usuarioId,solicitudId,session);if(!r)throw falla("No hay recibo verificable de ese activo; continúa sin confirmar",404);await verificarActivos(usuarioId,await C.find({usuarioId}).limit(501).maxTimeMS(5000).session(session).lean(),{session});await verificarFuentes(r,session);salida=resumen(r);},{readConcern:{level:"snapshot"},readPreference:"primary"});return salida;}finally{await session.endSession();}}
async function verificarActivos(usuarioId,activos,{session,legados}={}){
 if(!session?.inTransaction())throw falla("La verificación de activos requiere lectura consistente",503);await exigirIndices();
 const recibos=await R.find({usuarioId}).limit(501).maxTimeMS(5000).session(session).lean();legados??=await L.find({userId:usuarioId}).limit(501).maxTimeMS(5000).session(session).lean();
 if(!Array.isArray(activos)||activos.length>500||legados.length>500||recibos.length>500)throw falla("Demasiados activos para verificar fuentes",503);
 const cs=new Map(activos.map(x=>[String(x._id),x])),ls=new Map(legados.map(x=>[String(x._id),x])),rs=new Map(recibos.map(x=>[x.solicitudId,x]));
 if(cs.size!==activos.length||ls.size!==legados.length||rs.size!==recibos.length)throw falla("Identidad duplicada de activos");
 for(const r of recibos)verificarPareja(r,cs.get(String(r.activoId)),ls.get(String(r.legacyId)));
 for(const c of activos)if(c.creacionSolicitudId!==undefined||c.creacionReciboHash!==undefined){const r=rs.get(c.creacionSolicitudId);if(!r||String(r.activoId)!==String(c._id)||r.hashActual!==c.creacionReciboHash)throw falla("Falta evidencia de creación del activo");}
 for(const l of legados)if(l.creacionSolicitudId!==undefined){const r=rs.get(l.creacionSolicitudId);if(!r||String(r.legacyId)!==String(l._id))throw falla("Falta evidencia de la fuente original del activo");}
 return require("./lecturaActivosPersonal.service").calcular(usuarioId,legados,activos);
}
module.exports={crear,consultar,exigirIndices,validarIdentidad,validarSolicitud,normalizarNombre,huellaSolicitud,hash,verificar,verificarActivos,resumen};
