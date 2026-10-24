"use strict";
const crypto=require("node:crypto");
const mongoose=require("mongoose");
const Movimiento=require("../models/TransaccionPersonal");
const {exigirIndiceIdempotencia}=require("./indiceIdempotenciaPersonal.service");
const FRECUENCIAS=new Set(["NINGUNA","DIARIA","SEMANAL","QUINCENAL","MENSUAL","ANUAL"]);
function fallo(msg,statusCode=400){return Object.assign(new Error(msg),{statusCode});}
function validarObligacion(usuarioId,input){
 if(!mongoose.isValidObjectId(usuarioId)||!input||typeof input!=="object"||
    Array.isArray(input))throw fallo("Identidad o obligación inválida");
 const campos=new Set(["montoMinor","concepto","categoria","fecha",
  "recurrente","frecuencia","externalId"]);
 if(Object.keys(input).some(c=>!campos.has(c)))throw fallo("Campo no permitido para obligación");
 if(!Number.isSafeInteger(input.montoMinor)||input.montoMinor<=0)
  throw fallo("Importe de obligación inválido");
 if(typeof input.concepto!=="string"||!input.concepto.trim()||
    input.concepto.length>140||typeof input.categoria!=="string"||
    !input.categoria.trim()||input.categoria.length>80)
  throw fallo("Concepto o categoría inválidos");
 const fecha=new Date(input.fecha);
 if(!input.fecha||!Number.isFinite(fecha.getTime()))
  throw fallo("Vencimiento inválido");
 if(typeof input.recurrente!=="boolean"||
    !FRECUENCIAS.has(input.frecuencia)||
    (input.recurrente===(input.frecuencia==="NINGUNA")))
  throw fallo("Periodicidad incompatible con la obligación");
 if(typeof input.externalId!=="string"||!input.externalId.trim()||
    input.externalId.length>160)throw fallo("externalId estable obligatorio");
 return {usuarioId:new mongoose.Types.ObjectId(usuarioId),
  tipo:"GASTO",montoMinor:input.montoMinor,moneda:"COP",
  concepto:input.concepto.trim(),categoria:input.categoria.trim(),
  fecha,recurrente:input.recurrente,frecuencia:input.frecuencia,
  impactoCaja:false,cuentaId:null,cuenta:"SIN_CAJA",
  medioPago:"OTRO",origen:"MANUAL",estado:"ACTIVA"};
}
function crearRegistradorObligacionPersonal({
 MovimientoModelo=Movimiento,
 nuevaSesion=()=>mongoose.startSession(),
 verificarIndice=()=>exigirIndiceIdempotencia(MovimientoModelo)
}={}){
 return async function registrar(usuarioId,input){
  const documento=validarObligacion(usuarioId,input);
  const secret=process.env.PERSONAL_IDEMPOTENCY_SECRET;
  if(typeof secret!=="string"||!secret)throw fallo("Idempotencia no disponible",503);
  documento.externalIdHash=crypto.createHmac("sha256",secret)
   .update(String(usuarioId)).update(":").update(input.externalId).digest("hex");
  await verificarIndice();
  const session=await nuevaSesion();
  try{
   let resultado;
   await session.withTransaction(async()=>{
    const previo=await MovimientoModelo.findOne({
     usuarioId:documento.usuarioId,externalIdHash:documento.externalIdHash
    }).session(session).lean();
    if(previo)throw fallo("Obligación ya registrada; confirma el intento",409);
    const creados=await MovimientoModelo.create([documento],{session});
    if(!Array.isArray(creados)||creados.length!==1)
     throw fallo("No se confirmó el registro",503);
    resultado=creados[0];
   },{readConcern:{level:"snapshot"},writeConcern:{w:"majority"},readPreference:"primary"});
   return resultado;
  }catch(e){
   if(e?.code===11000)throw fallo("Obligación duplicada; confirma el intento",409);
   throw e;
  }finally{await session.endSession();}
 };
}
module.exports={crearRegistradorObligacionPersonal,validarObligacion};
