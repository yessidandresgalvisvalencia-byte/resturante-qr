"use strict";
const crypto=require("crypto");
const Prestamo=require("../models/prestamoPersonal.model");
const Notificacion=require("../models/notificacionPersonal.model");
const {personalEventBus,PERSONAL_EVENTS}=require("../events/eventBusPersonal");

function llaveDia(now=new Date()){return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Bogota",year:"numeric",month:"2-digit",day:"2-digit"}).format(now);}
function finMananaColombia(now=new Date()){const key=llaveDia(now);const [y,m,d]=key.split("-").map(Number);return new Date(Date.UTC(y,m-1,d+2,4,59,59,999));}
async function ejecutar(now=new Date()){
 const limite=finMananaColombia(now),hoy=llaveDia(now);
 const rows=await Prestamo.find({direccion:"POR_COBRAR",estado:{$in:["ACTIVO","VENCIDO"]},saldoMinor:{$gt:0},fechaVencimiento:{$ne:null,$lte:limite}}).lean();
 let emitidos=0;
 for(const p of rows){
  const vencida=llaveDia(p.fechaVencimiento)<hoy,clave="COBRO:"+String(p._id)+":"+hoy;
  const mensaje=(p.contraparte||"Alguien")+" te debe "+new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(p.saldoMinor)+".";
  let n;try{n=await Notificacion.create({usuarioId:p.usuarioId,clave,tipo:"RECORDATORIO_COBRO",titulo:vencida?"Cobro vencido":"Cobro por vencer",mensaje,payload:{prestamoId:String(p._id),contraparte:p.contraparte,saldoMinor:p.saldoMinor,fechaVencimiento:p.fechaVencimiento,estado:vencida?"VENCIDA":"POR_VENCER"}});}catch(e){if(e?.code===11000)continue;throw e;}
  personalEventBus.emitFinancial(PERSONAL_EVENTS.RECORDATORIO_COBRO,{eventId:crypto.randomUUID(),usuarioId:String(p.usuarioId),aggregateId:String(n._id),payload:{notificacionId:String(n._id),...n.payload,mensaje}});
  emitidos++;
 }
 return{revisados:rows.length,emitidos};
}
module.exports={ejecutar};
