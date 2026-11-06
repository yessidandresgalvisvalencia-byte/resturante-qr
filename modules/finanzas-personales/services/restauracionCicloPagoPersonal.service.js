"use strict";
const mongoose=require("mongoose"),I=require("./imputacionPagoPersonal.service"),C=require("./cicloPagoPrestamoPersonal.service"),E=require("../models/imputacionPagoPersonal.model"),P=require("../models/prestamoPersonal.model");
const falla=(m,c=409)=>Object.assign(Error(m),{statusCode:c}),GENESIS="0".repeat(64);
const clave=(u,p,m,k)=>"rest_ciclo_"+I.digest({usuarioId:String(u),prestamoId:String(p),movimientoId:String(m),idempotencyKey:k});
function solicitud(u,p,f,k,anulacionHash,compensacionHash,m){
 if(!m||Object.keys(m).sort().join(",")!=="confirmacion,contextoEsperado,eventoEsperado,fuenteHashEsperado,motivo,revisionEsperada,tratamiento"||!["APLICAR","EXCLUIR"].includes(m.tratamiento))throw falla("Confirma la imputación exacta de la recuperación",422);
 return I.validar(u,p,{...m,movimientoId:String(f._id),restauracionAnulacionHash:anulacionHash,restauracionCompensacionHash:compensacionHash},clave(u,p,f._id,k));
}
function validarCambioFecha(f,p){
 const original=C.verificar(f),actual=C.contexto(p);if(!original||String(f.usuarioId)!==String(p.usuarioId)||String(f.prestamoId)!==String(p._id))throw falla("El ciclo original no es verificable");
 if(!actual.fechaVencimiento||actual.periodicidadConfirmada!==true||!Number.isSafeInteger(actual.cuotaMinor)||actual.cuotaMinor<1)throw falla("Confirma fecha, cuota y periodicidad actuales");
 const antes={...original.contexto},ahora={...actual};delete antes.fechaVencimiento;delete ahora.fechaVencimiento;
 if(I.digest(antes)!==I.digest(ahora))throw falla("Las condiciones de cuota cambiaron; esta recuperación solo admite cambio de fecha");
 if(original.contexto.fechaVencimiento===actual.fechaVencimiento)throw falla("El ciclo no cambió; usa la restauración normal",400);return{original:original.contexto,actual};
}
async function registrarEnSesion(u,p,f,k,ann,comp,m,session){
 if(!session?.inTransaction()||typeof p.set!=="function")throw falla("Recuperación requiere transacción y préstamo verificables");validarCambioFecha(f,p);const s=solicitud(u,p._id,f,k,ann,comp,m),map=await I.leerEnSesion(u,[p.toObject()],session),prev=map.get(String(f._id));
 if((p.imputacionRevision??0)!==s.revisionEsperada||I.digest(C.contexto(p))!==I.digest(s.contextoEsperado)||I.fuenteHash(f)!==s.fuenteHashEsperado||(prev?.hashActual??null)!==s.eventoEsperado)throw falla("La fuente o el ciclo cambió; revisa antes de recuperar");
 if((p.imputacionRevision??0)>=1000)throw falla("Historial de imputación fuera de capacidad",422);
 const e={usuarioId:u,prestamoId:p._id,movimientoId:f._id,secuencia:(p.imputacionRevision??0)+1,solicitudId:clave(u,p._id,f._id,k),solicitudHash:I.digest(s),solicitud:s,fecha:new Date(),hashAnterior:p.imputacionHash??GENESIS};e.firma=I.firma(e);e.hashActual=I.hash(e);const [guardado]=await E.create([e],{session});p.set({imputacionRevision:e.secuencia,imputacionHash:e.hashActual});return guardado.toObject();
}
async function verificarReplay(u,pid,f,k,ann,comp,m,session){
 const e=await E.findOne({usuarioId:u,solicitudId:clave(u,pid,f._id,k)}).maxTimeMS(5000).session(session).lean();if(!e&&m===undefined)return null;if(!e||m===undefined)throw falla("Conserva la solicitud original de restauración y ciclo");const p=await P.findOne({_id:pid,usuarioId:u,direccion:"POR_PAGAR"}).session(session).lean();if(!p)throw falla("Préstamo no encontrado",404);await I.leerEnSesion(u,[p],session);const s=solicitud(u,pid,f,k,ann,comp,m);if(String(e.movimientoId)!==String(f._id)||String(e.prestamoId)!==String(pid)||e.solicitudHash!==I.digest(s)||e.noAplicada===true)throw falla("Clave de recuperación usada con otros datos");return e;
}
function recibo(u,pid,f,k,ann,comp,m,e){if(!e)return undefined;return{usuarioId:String(u),confirmado:true,certificaEstadoActual:false,autorizaGasto:false,afectaCaja:f.impactoCaja===true,solicitudId:k,prestamoId:String(pid),movimientoId:String(f._id),ruta:"/prestamos/"+pid+"/cuotas/restaurar-con-ciclo",metodo:"POST",anulacionHash:ann,compensacionHash:comp,imputacionHash:e.hashActual,solicitudHuella:I.digest({metodo:"POST",path:"/prestamos/"+pid+"/cuotas/restaurar-con-ciclo",cuerpo:{movimientoId:String(f._id),anulacionHash:ann,confirmar:true,imputacion:m}})};}
async function consultarRecibo(u,pid,mid,k){
 if(![u,pid,mid].every(x=>mongoose.isObjectIdOrHexString(x))||typeof k!=="string"||!/^[A-Za-z0-9_-]{8,128}$/.test(k))throw falla("Recibo de recuperación inválido",400);
 const session=await mongoose.startSession();try{return await session.withTransaction(async()=>{
  const p=await P.findOne({_id:pid,usuarioId:u,direccion:"POR_PAGAR"}).maxTimeMS(5000).session(session).lean();if(!p)throw falla("Recuperación no encontrada",404);
  await I.leerEnSesion(u,[p],session);const e=await E.findOne({usuarioId:u,prestamoId:pid,movimientoId:mid,solicitudId:clave(u,pid,mid,k)}).maxTimeMS(5000).session(session).lean();if(!e||e.noAplicada===true||!e.solicitud.restauracionAnulacionHash||!e.solicitud.restauracionCompensacionHash)throw falla("Recibo no encontrado; conserva la solicitud original",404);
  const f=await require("../models/TransaccionPersonal").findOne({_id:mid,usuarioId:u,prestamoId:pid,tipo:"PAGO_DEUDA"}).maxTimeMS(5000).session(session).lean();if(!f||!C.verificar(f)||I.fuenteHash(f)!==e.solicitud.fuenteHashEsperado)throw falla("Fuente original no verificable");
  const {cadena}=await require("./registradorCompensacionPersonal.service").leerCadenaVerificada(String(u),{session}),comp=cadena.find(x=>x.hashActual===e.solicitud.restauracionCompensacionHash);if(!comp||comp.tipo!=="RESTAURACION"||comp.movimientoId!==String(mid)||comp.idempotencyKey!==k||comp.anulacionHash!==e.solicitud.restauracionAnulacionHash)throw falla("Compensación de recuperación no verificable");
  const m=Object.fromEntries(["revisionEsperada","fuenteHashEsperado","eventoEsperado","contextoEsperado","tratamiento","motivo","confirmacion"].map(x=>[x,e.solicitud[x]]));return{recibo:recibo(u,pid,f,k,comp.anulacionHash,comp.hashActual,m,e)};
 },{readConcern:{level:"snapshot"},readPreference:"primary"});}finally{await session.endSession();}
}
module.exports={consultarRecibo,clave,solicitud,validarCambioFecha,registrarEnSesion,verificarReplay,recibo};
