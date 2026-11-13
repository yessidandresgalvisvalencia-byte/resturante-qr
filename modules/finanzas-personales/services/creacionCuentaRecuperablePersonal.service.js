"use strict";
const mongoose=require("mongoose"),crypto=require("node:crypto"),R=require("../models/reciboCreacionCuentaPersonal.model"),C=require("../models/cuentaFinanciera.model"),O=require("../models/outboxPersonal.model"),T=require("../models/TransaccionPersonal");
const auditoria=require("../security/contextoAuditoriaCuentaPersonal.service");
const {indiceExacto}=require("../security/auditoriaIndicesMongoV81.service");
const falla=(m,c=409)=>Object.assign(new Error(m),{statusCode:c});
function canon(v){if(v instanceof Date)return v.toISOString();if(v instanceof mongoose.Types.ObjectId)return String(v);if(v===null||typeof v!=="object")return v;if(Array.isArray(v))return v.map(canon);return Object.fromEntries(Object.keys(v).sort().map(k=>[k,canon(v[k])]));}
const digest=v=>crypto.createHash("sha256").update(JSON.stringify(canon(v))).digest("hex");
const normalizarNombre=v=>v.normalize("NFKC").trim().replace(/\s+/g," ").toUpperCase();
const huellaSolicitud=solicitud=>digest({metodo:"POST",path:"/cuentas",cuerpo:solicitud});
const hash=r=>digest({...Object.fromEntries(["usuarioId","solicitudId","solicitudHuella","cuentaId","nombreClave","solicitud","original","evento","fecha"].map(k=>[k,r[k]])),...auditoria.enlace(r)});
function validarIdentidad(usuarioId,solicitudId){if(!mongoose.isValidObjectId(usuarioId)||typeof solicitudId!=="string"||!/^cuenta_[A-Za-z0-9_-]{8,80}$/.test(solicitudId))throw falla("Identidad estable de cuenta inválida",400);}
function validarSolicitud(s){
 const campos=["confirmacion","nombre","tipo","institucion","moneda","saldoMinor","saldoVerificado","fechaSaldo"];
 if(!s||typeof s!=="object"||Array.isArray(s)||s.confirmacion!==true||Object.keys(s).some(k=>!campos.includes(k)))throw falla("Confirma explícitamente los datos de la cuenta",400);
 if(typeof s.nombre!=="string"||s.nombre.length>100||/[\u0000-\u001f\u007f]/.test(s.nombre)||!normalizarNombre(s.nombre)||normalizarNombre(s.nombre).length>100||s.institucion!==undefined&&(typeof s.institucion!=="string"||s.institucion.length>120))throw falla("Revisa nombre e institución de la cuenta",422);
 if(!["EFECTIVO","AHORROS","CORRIENTE","BILLETERA"].includes(s.tipo)||s.moneda!=="COP")throw falla("La cuenta de caja requiere tipo líquido conocido y moneda COP",422);
 if(!Number.isSafeInteger(s.saldoMinor)||s.saldoMinor<0||typeof s.saldoVerificado!=="boolean")throw falla("Indica un saldo entero exacto no negativo y si lo verificaste",422);
 if(typeof s.fechaSaldo!=="string"||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(s.fechaSaldo)||!Number.isFinite(+new Date(s.fechaSaldo))||new Date(s.fechaSaldo).toISOString()!==s.fechaSaldo||+new Date(s.fechaSaldo)>Date.now())throw falla("La fecha del saldo debe ser válida, explícita y no futura",422);
 return{nombre:normalizarNombre(s.nombre),tipo:s.tipo,institucion:s.institucion?.trim()||"",moneda:"COP",saldoMinor:s.saldoMinor,activa:true,saldoVerificadoEn:s.saldoVerificado?new Date(s.fechaSaldo):null,saldoAnclaEn:s.saldoVerificado?new Date(s.fechaSaldo):null,saldoAnclaMinor:s.saldoVerificado?s.saldoMinor:null,origenSaldo:s.saldoVerificado?"USUARIO":"NO_VERIFICADO",requiereReconciliacion:!s.saldoVerificado};
}
async function exigirIndices(){let indices;try{indices=await R.collection.indexes();}catch{throw falla("Índices de recibos de cuenta no disponibles",503);}if(![["usuarioId","solicitudId"],["usuarioId","cuentaId"],["usuarioId","nombreClave"]].every(k=>indiceExacto(indices,k)))throw falla("Índices de recibos de cuenta no verificados",503);}
const buscar=(usuarioId,solicitudId,session)=>R.findOne({usuarioId,solicitudId}).session(session).maxTimeMS(5000).lean();
const oid=v=>new mongoose.Types.ObjectId(String(v));
const fuenteEvento=e=>Object.fromEntries(["usuarioId","eventId","eventName","aggregateType","aggregateId","payload"].map(k=>[k,e[k]]));
function verificar(r){
 auditoria.validarDocumento(r,r?.usuarioId);
 if(!r||r.hashActual!==hash(r)||r.solicitudHuella!==huellaSolicitud(r.solicitud)||String(r.original?._id)!==String(r.cuentaId)||String(r.original?.usuarioId)!==String(r.usuarioId))throw falla("Recibo de cuenta no verificable");
 const d=canon(validarSolicitud(r.solicitud));if(r.nombreClave!==d.nombre||Object.entries(d).some(([k,v])=>JSON.stringify(canon(r.original[k]))!==JSON.stringify(v)))throw falla("La cuenta original no corresponde a la declaración");
 if(r.solicitud.saldoVerificado){const e=r.evento;if(!e||String(e.usuarioId)!==String(r.usuarioId)||String(e.aggregateId)!==String(r.cuentaId)||e.eventName!=="SALDO_CUENTA_RECONCILIADO"||e.aggregateType!=="CUENTA_FINANCIERA_PERSONAL"||e.payload?.cuentaId!==String(r.cuentaId)||e.payload.saldoMinor!==d.saldoMinor||e.payload.saldoAnclaEn!==r.solicitud.fechaSaldo||e.payload.solicitudId!==r.solicitudId||e.payload.origenSaldo!=="USUARIO"||e.payload.motivo!=="APERTURA_DECLARADA")throw falla("Evidencia de saldo inicial no verificable");}
 else if(r.evento!==null)throw falla("Una cuenta sin verificar no acredita un ancla");return r;
}
async function verificarFuentes(r,session){
 verificar(r);const actual=await C.collection.findOne({_id:oid(r.cuentaId),usuarioId:oid(r.usuarioId)},{session,maxTimeMS:5000});if(!actual)throw falla("La cuenta creada requiere revisión");
 if(r.evento){const e=await O.collection.findOne({_id:oid(r.evento._id),usuarioId:oid(r.usuarioId)},{session,maxTimeMS:5000});if(!e||digest(fuenteEvento(e))!==digest(fuenteEvento(r.evento)))throw falla("El evento de apertura requiere revisión");}return r;
}
function resumen(r){return{confirmado:true,solicitudId:r.solicitudId,solicitudHuella:r.solicitudHuella,cuentaId:String(r.cuentaId),hash:r.hashActual,ruta:"/cuentas",metodo:"POST",certificaEstadoActual:false,contextoAuditoria:auditoria.resumen(r.auditoriaContexto)};}
const resultado=(r,duplicado)=>({cuenta:r.original,recibo:resumen(r),duplicado});
async function crear(usuarioId,solicitudId,solicitud,opciones={}){
 validarIdentidad(usuarioId,solicitudId);const datos=validarSolicitud(solicitud),huella=huellaSolicitud(solicitud),capturar=auditoria.resolver(usuarioId,opciones);await exigirIndices();const session=await mongoose.startSession();let salida;
 try{await session.withTransaction(async()=>{
  const previo=await buscar(usuarioId,solicitudId,session);if(previo){if(previo.solicitudHuella!==huella)throw falla("La clave de cuenta ya identifica otros datos");await verificarFuentes(previo,session);salida=resultado(previo,true);return;}
  const cuentas=await C.find({usuarioId}).select("nombre").limit(501).maxTimeMS(5000).session(session).lean();if(cuentas.length>500)throw falla("Demasiadas cuentas para verificar nombres; requiere revisión",503);
  if(cuentas.some(c=>typeof c.nombre!=="string"||normalizarNombre(c.nombre)===datos.nombre))throw falla("Ya existe una cuenta con ese nombre; revisa o recupera la original");
  const huerfano=await T.collection.findOne({usuarioId:oid(usuarioId),cuentaId:null,impactoCaja:{$ne:false}},{session,maxTimeMS:5000});if(huerfano)throw falla("Hay movimientos sin cuenta identificada. Revisa su conciliación antes de crear otra cuenta");
  const auditoriaContexto=capturar();
  const [cuenta]=await C.create([{usuarioId,...datos}],{session});let evento=null;
  if(solicitud.saldoVerificado){const [e]=await O.create([{usuarioId,eventId:crypto.randomUUID(),eventName:"SALDO_CUENTA_RECONCILIADO",aggregateType:"CUENTA_FINANCIERA_PERSONAL",aggregateId:cuenta._id,payload:{cuentaId:String(cuenta._id),saldoMinor:datos.saldoMinor,saldoAnclaEn:solicitud.fechaSaldo,origenSaldo:"USUARIO",motivo:"APERTURA_DECLARADA",solicitudId}}],{session});evento=await O.collection.findOne({_id:e._id,usuarioId:oid(usuarioId)},{session,maxTimeMS:5000});if(!evento)throw falla("Evento de apertura ausente");}
  const original=await C.collection.findOne({_id:cuenta._id,usuarioId:oid(usuarioId)},{session,maxTimeMS:5000});if(!original)throw falla("Cuenta original ausente");
  const r={auditoriaContexto,usuarioId,solicitudId,solicitudHuella:huella,cuentaId:cuenta._id,nombreClave:datos.nombre,solicitud:canon(solicitud),original:canon(original),evento:canon(evento),fecha:new Date()};r.hashActual=hash(r);verificar(r);await R.create([r],{session});salida=resultado(r,false);
 },{readConcern:{level:"snapshot"},writeConcern:{w:"majority"},readPreference:"primary"});return salida;
 }catch(e){if(e.code===11000)throw falla("Cuenta o solicitud ya registrada; consulta su recibo antes de repetirla");throw e;}finally{await session.endSession();}
}
async function consultar(usuarioId,solicitudId){validarIdentidad(usuarioId,solicitudId);await exigirIndices();const session=await mongoose.startSession();let salida;try{await session.withTransaction(async()=>{const r=await buscar(usuarioId,solicitudId,session);if(!r)throw falla("No hay recibo verificable de esa cuenta; continúa sin confirmar",404);await verificarFuentes(r,session);salida=resumen(r);},{readConcern:{level:"snapshot"},readPreference:"primary"});return salida;}finally{await session.endSession();}}
module.exports={crear,consultar,exigirIndices,validarIdentidad,validarSolicitud,normalizarNombre,huellaSolicitud,hash,verificar,resumen};
