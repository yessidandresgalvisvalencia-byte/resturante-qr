"use strict";
const mongoose=require("mongoose");
const Transaccion=require("../models/TransaccionPersonal");
const Cuenta=require("../models/cuentaFinanciera.model");

// Diagnóstico no destructivo: el nombre histórico sólo es una pista, nunca
// autorización automática para cambiar un movimiento o un saldo.
function evaluarCandidatoVinculo(movimiento,cuentas){
 if(!movimiento||!Array.isArray(cuentas))throw new TypeError("Datos de vínculo inválidos");
 if(movimiento.cuentaId!=null)return {estado:"YA_VINCULADO",cuentaId:null};
 const nombre=typeof movimiento.cuenta==="string"?movimiento.cuenta.trim():"";
 if(!nombre)return {estado:"SIN_NOMBRE",cuentaId:null};
 const coincidencias=cuentas.filter(c=>c&&c.activa===true&&c.moneda==="COP"&&
  typeof c.nombre==="string"&&c.nombre.trim()===nombre);
 if(coincidencias.length!==1)return {estado:coincidencias.length===0?"SIN_COINCIDENCIA":"AMBIGUO",cuentaId:null};
 return {estado:"REQUIERE_CONFIRMACION",cuentaId:String(coincidencias[0]._id)};
}
async function diagnosticarVinculosHistoricosV81(usuarioId,{limite=100}={}){
 if(!mongoose.isValidObjectId(usuarioId)||!Number.isSafeInteger(limite)||limite<1||limite>100)
  throw Object.assign(new TypeError("Parámetros inválidos"),{statusCode:400});
 const filtro={usuarioId,cuentaId:null,estado:{$ne:"ANULADA"},moneda:"COP"};
 const session=await mongoose.startSession();
 try{
  return await session.withTransaction(async()=>{
   const [cuentas,filas]=await Promise.all([
    Cuenta.find({usuarioId,activa:true,moneda:"COP"}).session(session).select("_id nombre activa moneda").lean(),
    Transaccion.find(filtro).sort({_id:1}).limit(limite+1).session(session)
     .select("_id cuenta cuentaId tipo fecha").lean()
   ]);
   const truncado=filas.length>limite;
   const movimientos=filas.slice(0,limite).map(f=>({
    movimientoId:String(f._id),cuentaHistorica:f.cuenta||"",
    ...evaluarCandidatoVinculo(f,cuentas)
   }));
   return {soloLectura:true,modificaSaldos:false,vinculaAutomaticamente:false,
    requiereConfirmacionIndividual:true,truncado,movimientos,
    advertencia:"El nombre de una cuenta no constituye evidencia suficiente para vincular automáticamente un asiento histórico."};
  },{readConcern:{level:"snapshot"},readPreference:"primary"});
 }finally{await session.endSession();}
}
module.exports={evaluarCandidatoVinculo,diagnosticarVinculosHistoricosV81};
