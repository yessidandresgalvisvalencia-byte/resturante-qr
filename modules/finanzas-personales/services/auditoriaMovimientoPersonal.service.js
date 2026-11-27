"use strict";
const mongoose=require("mongoose"),Tx=require("../models/TransaccionPersonal"),Aud=require("../security/contextoAuditoriaCompensacionPersonal.service"),{leerCadenaVerificada,GENESIS}=require("./registradorCompensacionPersonal.service"),{originalDesdeFuente}=require("./eventoCompensatorioPersonal.service"),{vigente}=require("./estadoCompensadoPersonal.service");
const Registro=require("./auditoriaRegistroPersonal.service");
const fallo=(m,statusCode=409)=>Object.assign(Error(m),{statusCode}),TAMANO=20;
function consulta(q={}){
 if(!q||typeof q!=="object"||Array.isArray(q)||Object.keys(q).some(k=>!["pagina","headHash"].includes(k)))throw fallo("Consulta de auditoría inválida",400);
 const p=q.pagina===undefined?"1":q.pagina;
 if(typeof p!=="string"||! /^[1-9][0-9]{0,2}$/.test(p)||Number(p)>500||q.headHash!==undefined&&(typeof q.headHash!=="string"||! /^[a-f0-9]{64}$/.test(q.headHash))||Number(p)>1&&q.headHash===undefined)throw fallo("Página o referencia de auditoría inválida",400);
 return{pagina:Number(p),headHash:q.headHash};
}
function crearConsulta({TransaccionModelo=Tx,leerCadena=leerCadenaVerificada,nuevaSesion=()=>mongoose.startSession(),ahora=()=>new Date()}={}){
 return async function consultar(usuarioId,movimientoId,q={}){
  const filtros=consulta(q);
  if(!mongoose.isObjectIdOrHexString(usuarioId)||!mongoose.isObjectIdOrHexString(movimientoId))throw fallo("Identidad de auditoría inválida",400);
  const u=new mongoose.Types.ObjectId(String(usuarioId)).toHexString(),id=new mongoose.Types.ObjectId(String(movimientoId)).toHexString(),session=await nuevaSesion();
  try{let resultado;await session.withTransaction(async()=>{
   const fuente=await TransaccionModelo.findOne({_id:id,usuarioId:u}).select("+auditoriaRegistro").maxTimeMS(5000).session(session).lean();
   if(!fuente)throw fallo("Movimiento no disponible",404);
   if(fuente.estado!=="ACTIVA"||fuente.moneda!=="COP")throw fallo("La fuente histórica requiere revisión antes de verificar esta auditoría");
   if(!["INGRESO","GASTO","PAGO_DEUDA","COBRO_PRESTAMO"].includes(fuente.tipo))throw fallo("Este movimiento requiere su auditoría específica",422);
   const registroOriginal=Registro.verificar(fuente);
   let original;try{original=originalDesdeFuente(fuente);}catch{throw fallo("Fuente financiera no verificable");}
   const {cadena,cursor}=await leerCadena(u,{session}),headHash=cursor?.hashActual||GENESIS;
   if(filtros.headHash!==undefined&&filtros.headHash!==headHash)throw fallo("La cadena cambió; actualiza la auditoría desde la primera página");
   const eventos=cadena.filter(e=>e.movimientoId===id);let estado;try{estado=vigente(original,eventos);}catch{throw fallo("INTEGRIDAD_LEDGER: auditoría del movimiento inconsistente");}
   const inicio=(filtros.pagina-1)*TAMANO;
   if(filtros.pagina>1&&inicio>=eventos.length)throw fallo("Página fuera de la auditoría disponible",400);
   resultado={soloLectura:true,afectaCaja:false,alcance:"COMPENSACIONES_DEL_MOVIMIENTO",certificaCustodiaIndependiente:false,usuarioId:u,movimientoId:id,consultadoEn:ahora().toISOString(),headCadena:{secuencia:cursor?.secuencia||0,hash:headHash},registroOriginal,pagina:filtros.pagina,total:eventos.length,hayMas:inicio+TAMANO<eventos.length,original,estadoMovimiento:{...estado.actual,estado:estado.anulado?"ANULADA":"ACTIVA"},eventos:eventos.slice(inicio,inicio+TAMANO).map(Aud.visible)};
  },{readConcern:{level:"snapshot"},readPreference:"primary"});return resultado;}finally{await session.endSession();}
 };
}
module.exports={consulta,crearConsulta,consultar:crearConsulta()};
