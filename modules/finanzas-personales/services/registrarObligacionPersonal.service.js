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
 // La fecha puede llegar como Date tras Joi o como ISO estricto
 // desde un consumidor interno. No aceptar epochs, objetos ni cadenas
 // ambiguas que Date.parse normaliza en silencio.
 if(!(input.fecha instanceof Date)&&
    !(typeof input.fecha==="string"&&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(input.fecha)))
  throw fallo("Vencimiento requiere ISO-8601 con zona horaria");
 // Date.parse normaliza fechas imposibles (ej. 30 de febrero).
 // Comparar los componentes locales originales con el instante calculado
 // evita que un vencimiento se desplace silenciosamente al mes siguiente.
 if(typeof input.fecha==="string"){
  const p=/^(\\d{4})-(\\d{2})-(\\d{2})T(\\d{2}):(\\d{2}):(\\d{2})(?:\\.(\\d{1,3}))?(Z|([+-])(\\d{2}):(\\d{2}))$/.exec(input.fecha);
  if(!p)throw fallo("Vencimiento ISO inválido");
  const [anio,mes,dia,hora,minuto,segundo]=p.slice(1,7).map(Number);
  const offHoras=p[9]?Number(p[10]):0,offMin=p[9]?Number(p[11]):0;
  if(offHoras>23||offMin>59)throw fallo("Zona horaria inválida");
  const offset=(p[9]==="-"?-1:1)*(offHoras*60+offMin);
  const local=Date.UTC(anio,mes-1,dia,hora,minuto,segundo);
  const fechaLocal=new Date(local);
  if(!Number.isFinite(local)||fechaLocal.getUTCFullYear()!==anio||
    fechaLocal.getUTCMonth()!==mes-1||fechaLocal.getUTCDate()!==dia||
    fechaLocal.getUTCHours()!==hora||fechaLocal.getUTCMinutes()!==minuto||
    fechaLocal.getUTCSeconds()!==segundo)
   throw fallo("Fecha calendario inexistente");
  // Mantener la validación por componentes incluso con offset.
  const real=new Date(input.fecha);
  if(!Number.isFinite(real.getTime())||
     real.getTime()!==local-offset*60000+
       (p[7]?Number(p[7].padEnd(3,"0")):0))
   throw fallo("Vencimiento incompatible con la zona horaria");
 }
 const fecha=new Date(input.fecha);
 if(!Number.isFinite(fecha.getTime()))
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
