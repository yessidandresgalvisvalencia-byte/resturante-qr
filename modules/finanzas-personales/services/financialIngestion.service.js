"use strict";
const crypto=require("node:crypto");
const mongoose=require("mongoose");
const Movimiento=require("../models/movimientoFuentePersonal.model");
const Outbox=require("../models/outboxPersonal.model");
const FUENTES=new Set(["GMAIL","BANCO_API","EXTRACTO","ANDROID"]);
function error(mensaje,statusCode=400){return Object.assign(new Error(mensaje),{statusCode});}
function validar(d){
 if(!d||!FUENTES.has(d.fuente))throw error("Fuente financiera inválida");
 if(typeof d.cuentaFuente!=="string"||!d.cuentaFuente.trim()||d.cuentaFuente.length>160)throw error("Cuenta fuente inválida");
 if(typeof d.referenciaExterna!=="string"||!d.referenciaExterna.trim()||d.referenciaExterna.length>300)throw error("Referencia de origen inválida");
 if(!Number.isSafeInteger(d.montoMinor)||d.montoMinor<=0)throw error("Monto inválido");
 if(!["ENTRADA","SALIDA"].includes(d.direccion))throw error("Dirección inválida");
 if(d.moneda!=="COP")throw error("Moneda no soportada");
 if(!["NOTIFICACION","EXTRACTO","API_BANCARIA"].includes(d.evidencia))throw error("Evidencia inválida");
 if((d.fuente==="GMAIL"||d.fuente==="ANDROID")&&d.evidencia!=="NOTIFICACION")throw error("La notificación no constituye confirmación bancaria");
 const fecha=new Date(d.fechaMovimiento);if(Number.isNaN(fecha.getTime())||fecha.getTime()>Date.now()+86400000)throw error("Fecha inválida");
 for(const [campo,max] of [["contraparte",160],["descripcion",500]])if(d[campo]!==undefined&&(typeof d[campo]!=="string"||d[campo].length>max))throw error("Campo inválido: "+campo);
 return fecha;
}
async function registrarMovimiento(usuarioId,d){
 if(!mongoose.isValidObjectId(usuarioId))throw error("Usuario inválido");
 const fecha=validar(d);
 const secret=process.env.PERSONAL_IDEMPOTENCY_SECRET;if(!secret||secret.length<32)throw error("Se requiere secreto de idempotencia seguro",503);
 const referenciaHash=crypto.createHmac("sha256",secret).update([usuarioId,d.fuente,d.cuentaFuente,d.referenciaExterna].join("|")).digest("hex");
 const session=await mongoose.startSession();
 try{
  let movimiento,duplicado=false;
  try{
   await session.withTransaction(async()=>{
    const previo=await Movimiento.findOne({usuarioId,fuente:d.fuente,cuentaFuente:d.cuentaFuente,referenciaHash}).session(session);
    if(previo){if(previo.montoMinor!==d.montoMinor||previo.direccion!==d.direccion||previo.fechaMovimiento.getTime()!==fecha.getTime())throw error("Referencia financiera conflictiva",409);movimiento=previo;duplicado=true;return;}
    [movimiento]=await Movimiento.create([{usuarioId,fuente:d.fuente,cuentaFuente:d.cuentaFuente,referenciaHash,fechaMovimiento:fecha,montoMinor:d.montoMinor,direccion:d.direccion,moneda:"COP",contraparte:d.contraparte||"",descripcion:d.descripcion||"",evidencia:d.evidencia,estado:"DETECTADO"}],{session});
    await Outbox.create([{usuarioId,eventId:crypto.randomUUID(),eventName:"MOVIMIENTO_FINANCIERO_DETECTADO",aggregateType:"MOVIMIENTO_FUENTE_PERSONAL",aggregateId:movimiento._id,payload:{movimientoId:String(movimiento._id),fuente:d.fuente,evidencia:d.evidencia}}],{session});
   },{readConcern:{level:"snapshot"},writeConcern:{w:"majority"},readPreference:"primary"});
  }catch(e){
   if(e.code!==11000)throw e;
   movimiento=await Movimiento.findOne({usuarioId,fuente:d.fuente,cuentaFuente:d.cuentaFuente,referenciaHash});
   if(!movimiento||movimiento.montoMinor!==d.montoMinor||movimiento.direccion!==d.direccion||movimiento.fechaMovimiento.getTime()!==fecha.getTime())throw error("Referencia financiera conflictiva",409);
   duplicado=true;
  }
  return{movimiento,duplicado};
 }finally{await session.endSession();}
}
async function pendientes(usuarioId){return Movimiento.find({usuarioId,estado:{$in:["DETECTADO","PENDIENTE_CONFIRMACION"]}}).sort({createdAt:-1}).limit(100).lean();}
module.exports={registrarMovimiento,pendientes};
