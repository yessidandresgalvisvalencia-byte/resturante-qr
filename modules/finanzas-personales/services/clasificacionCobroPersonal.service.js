"use strict";
// Solo clasifica un origen persistido, sin inferirlo de persona, texto, importe ni defaults Mongoose.
function tipoParaOrigen(original){
 if(!original||!Object.hasOwn(original,"origenCuentaPorCobrar")||!["TRABAJO","PRESTAMO"].includes(original.origenCuentaPorCobrar))throw Object.assign(new Error("Confirma si la cuenta por cobrar corresponde a TRABAJO o PRESTAMO antes de registrar el pago; OTRO sigue pendiente de revisión."),{statusCode:409,code:"ORIGEN_COBRO_POR_CONFIRMAR"});
 return original.origenCuentaPorCobrar==="TRABAJO"?"INGRESO":"COBRO_PRESTAMO";
}
function verificarOrigenHistorico(original,ultimo){
 const tipo=tipoParaOrigen(original);
 if(ultimo&&ultimo.posterior?.origenCuentaPorCobrar!==original.origenCuentaPorCobrar)throw Object.assign(new Error("El origen actual no coincide con la corrección auditada; revisa el historial antes de cobrar."),{statusCode:409});
 return tipo;
}
function confirmacionExplicita(original,eventos){
 const e=eventos.findLast(e=>e.cambios&&Object.hasOwn(e.cambios,"origenCuentaPorCobrar"));
 return e&&e.cambios.origenCuentaPorCobrar===original.origenCuentaPorCobrar&&e.posterior?.origenCuentaPorCobrar===original.origenCuentaPorCobrar?e.hashActual:null;
}
async function evidenciaEnSesion(usuarioId,original,session){
 tipoParaOrigen(original);
 const C=require("./correccionPrestamoPersonal.service"),E=require("../models/correccionPrestamoPersonal.model");await C.exigirIndices();
 const eventos=await E.find({usuarioId,prestamoId:original._id}).sort({secuencia:1}).limit(1001).maxTimeMS(5000).session(session).lean();
 return{tipo:verificarOrigenHistorico(original,C.verificar(eventos,original)),confirmacionHash:confirmacionExplicita(original,eventos)};
}
async function tipoEnSesion(usuarioId,original,session){return(await evidenciaEnSesion(usuarioId,original,session)).tipo;}
module.exports={tipoParaOrigen,verificarOrigenHistorico,confirmacionExplicita,evidenciaEnSesion,tipoEnSesion};
