"use strict";
const crypto=require("crypto");
const Prestamo=require("../models/prestamoPersonal.model");
const {personalEventBus,PERSONAL_EVENTS}=require("../events/eventBusPersonal");
function inicioDia(d=new Date()){const x=new Date(d);x.setHours(0,0,0,0);return x;}
async function ejecutar(now=new Date()){
 const limite=new Date(now);limite.setDate(limite.getDate()+1);limite.setHours(23,59,59,999);
 const rows=await Prestamo.find({direccion:"POR_COBRAR",estado:{$in:["ACTIVO","VENCIDO"]},saldoMinor:{$gt:0},fechaVencimiento:{$ne:null,$lte:limite}}).lean();
 let emitidos=0;
 for(const p of rows){const vencida=p.fechaVencimiento<inicioDia(now);personalEventBus.emitFinancial(PERSONAL_EVENTS.RECORDATORIO_COBRO,{eventId:crypto.randomUUID(),usuarioId:String(p.usuarioId),aggregateId:String(p._id),payload:{prestamoId:String(p._id),contraparte:p.contraparte,saldoMinor:p.saldoMinor,fechaVencimiento:p.fechaVencimiento,estado:vencida?"VENCIDA":"POR_VENCER",mensaje:(p.contraparte||"Alguien")+" te debe "+new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(p.saldoMinor)+"."}});emitidos++;}
 return{revisados:rows.length,emitidos};
}
module.exports={ejecutar};
