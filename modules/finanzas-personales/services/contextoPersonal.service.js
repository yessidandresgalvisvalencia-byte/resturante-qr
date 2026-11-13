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
async function cargar(usuarioId){return Contexto.findOne({usuarioId}).maxTimeMS(5000).lean();}
async function recordar(usuarioId,{foco,entidadId=null,etiqueta="",ultimaIntencion="",ultimaPregunta=""}){
 return Contexto.findOneAndUpdate({usuarioId},{$set:{foco,entidadId,etiqueta,ultimaIntencion,ultimaPregunta:String(ultimaPregunta).slice(0,500),asOf:new Date()}},{upsert:true,new:true,setDefaultsOnInsert:true}).lean();
}
async function resolverDeuda(usuarioId,pregunta){
 const ref=detectarReferencia(pregunta),q=texto(pregunta);let deuda=null,origen=null;
 const estados={$in:["ACTIVO","VENCIDO"]};
 async function candidatas(extra){return Prestamo.find({usuarioId,direccion:"POR_PAGAR",estado:estados,...extra}).limit(2).maxTimeMS(5000).lean();}
 const explicita=/\bmoto\b/.test(q)?{$or:[{concepto:/moto/i},{contraparte:/moto/i}]}:/carro|vehículo|vehiculo/.test(q)?{$or:[{concepto:/carro|vehículo|vehiculo/i},{contraparte:/carro|vehículo|vehiculo/i}]}:null;
 if(explicita||ref.deudaExplicita){
  const filas=await candidatas(explicita||{});
  if(filas.length>1)return{aplica:true,deuda:null,origen:"AMBIGUA",referencia:ref};
  if(filas.length===1){deuda=filas[0];origen=explicita?"EXPLICITA":"UNICA_ACTIVA";}
 }
 // Una referencia explícita no encontrada no se sustituye por otra deuda recordada.
 if(!deuda&&!ref.deudaExplicita&&!explicita&&ref.seguimiento){
  const c=await cargar(usuarioId);
  if(c&&c.foco==="DEUDA"&&c.entidadId)deuda=await Prestamo.findOne({_id:c.entidadId,usuarioId,direccion:"POR_PAGAR",estado:estados}).maxTimeMS(5000).lean();
  if(deuda)origen="CONTEXTO";
 }
 return{aplica:Boolean(explicita||ref.deudaExplicita||ref.seguimiento),deuda,origen,referencia:ref};
}
module.exports={detectarReferencia,cargar,recordar,resolverDeuda};
