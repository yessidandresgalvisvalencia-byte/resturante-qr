"use strict";
const Contexto=require("../models/contextoConversacionalPersonal.model");
const Prestamo=require("../models/prestamoPersonal.model");
function texto(v){return String(v||"").trim().toLowerCase();}
function detectarReferencia(pregunta){
 const q=texto(pregunta);
 const deudaExplicita=/\b(deuda|cr[eé]dito|pr[eé]stamo|cuota|moto|carro|veh[ií]culo)\b/.test(q);
 const seguimiento=/\b(cu[aá]nto me falta|cu[aá]nto falta|cu[aá]nto debo|cu[aá]nto queda|qu[eé] me falta|cu[aá]ndo pago|cu[aá]ndo vence|pr[oó]xima cuota|cu[aá]nto tengo que separar|cu[aá]nto tengo que pagar)\b/.test(q);
 return{deudaExplicita,seguimiento};
}
async function cargar(usuarioId){return Contexto.findOne({usuarioId}).lean();}
async function recordar(usuarioId,{foco,entidadId=null,etiqueta="",ultimaIntencion="",ultimaPregunta=""}){
 return Contexto.findOneAndUpdate({usuarioId},{$set:{foco,entidadId,etiqueta,ultimaIntencion,ultimaPregunta:String(ultimaPregunta).slice(0,500),asOf:new Date()}},{upsert:true,new:true,setDefaultsOnInsert:true}).lean();
}
async function resolverDeuda(usuarioId,pregunta){
 const ref=detectarReferencia(pregunta);const q=texto(pregunta);let deuda=null;let origen=null;
 if(/\bmoto\b/.test(q)){deuda=await Prestamo.findOne({usuarioId,direccion:"POR_PAGAR",estado:"ACTIVO",$or:[{concepto:/moto/i},{contraparte:/moto/i}]}).sort({updatedAt:-1}).lean();origen="EXPLICITA";}
 if(!deuda&&ref.deudaExplicita){const activas=await Prestamo.find({usuarioId,direccion:"POR_PAGAR",estado:"ACTIVO"}).sort({updatedAt:-1}).limit(2).lean();if(activas.length===1){deuda=activas[0];origen="UNICA_ACTIVA";}}
 if(!deuda&&ref.seguimiento){const c=await cargar(usuarioId);if(c&&c.foco==="DEUDA"&&c.entidadId)deuda=await Prestamo.findOne({_id:c.entidadId,usuarioId,direccion:"POR_PAGAR",estado:"ACTIVO"}).lean();if(deuda)origen="CONTEXTO";}
 return{aplica:Boolean(ref.deudaExplicita||ref.seguimiento),deuda,origen,referencia:ref};
}
module.exports={detectarReferencia,cargar,recordar,resolverDeuda};
