"use strict";
const mongoose=require("mongoose");
const Transaccion=require("../models/TransaccionPersonal");
const Cuenta=require("../models/cuentaFinanciera.model");
const Vinculo=require("../models/vinculoHistoricoV81.model");

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
function evaluarEstadoVinculoHistorico(movimiento,cuentas,vinculo){
 if(!movimiento||!Array.isArray(cuentas))throw new TypeError("Datos de vínculo inválidos");
 if(!vinculo)return evaluarCandidatoVinculo(movimiento,cuentas);
 if(String(vinculo.movimientoId)!==String(movimiento._id))
  throw Object.assign(new Error("Evidencia histórica inconsistente: movimiento ajeno"),{statusCode:409});
 const cuenta=cuentas.find(c=>c&&c.activa===true&&c.moneda==="COP"&&
  String(c._id)===String(vinculo.cuentaId));
 if(!cuenta)
  throw Object.assign(new Error("Vínculo histórico apunta a cuenta no disponible para este usuario"),{statusCode:409});
 return {estado:"CONFIRMADO",cuentaId:String(cuenta._id)};
}
function indexarVinculosHistoricosV81(vinculos){
 if(!Array.isArray(vinculos))throw new TypeError("Vínculos históricos inválidos");
 const porMovimiento=new Map();
 for(const vinculo of vinculos){
  if(!vinculo||!mongoose.isValidObjectId(vinculo.movimientoId)||
     !mongoose.isValidObjectId(vinculo.cuentaId))
   throw Object.assign(new Error("Vínculo histórico sin identificadores válidos"),{statusCode:409});
  const id=String(vinculo.movimientoId);
  if(porMovimiento.has(id))
   throw Object.assign(new Error("Vínculos históricos duplicados para un movimiento"),{statusCode:409});
  porMovimiento.set(id,vinculo);
 }
 return porMovimiento;
}
function cursorHistoricoValidoV81(cursor){
 return cursor===undefined||typeof cursor==="string"&&/^[0-9a-f]{24}$/i.test(cursor);
}
async function diagnosticarVinculosHistoricosV81(usuarioId,{limite=100,cursor}={}){
 if(!mongoose.isValidObjectId(usuarioId)||!Number.isSafeInteger(limite)||limite<1||limite>100||
    !cursorHistoricoValidoV81(cursor))
  throw Object.assign(new TypeError("Parámetros inválidos"),{statusCode:400});
 const filtro={usuarioId,cuentaId:null,estado:{$ne:"ANULADA"},moneda:"COP"};
 if(cursor!==undefined)filtro._id={$gt:new mongoose.Types.ObjectId(cursor)};
 const session=await mongoose.startSession();
 try{
  return await session.withTransaction(async()=>{
   const cuentas=await Cuenta.find({usuarioId,activa:true,moneda:"COP"})
    .session(session).select("_id nombre activa moneda").lean();
   const filas=await Transaccion.find(filtro).sort({_id:1}).limit(limite+1)
    .session(session).select("_id cuenta cuentaId tipo fecha").lean();
   const truncado=filas.length>limite;
   const visibles=filas.slice(0,limite);
   const vinculos=visibles.length?await Vinculo.find({usuarioId,
    movimientoId:{$in:visibles.map(f=>f._id)}})
    .session(session).select("movimientoId cuentaId").lean():[];
   const porMovimiento=indexarVinculosHistoricosV81(vinculos);
   const movimientos=visibles.map(f=>({
    movimientoId:String(f._id),cuentaHistorica:f.cuenta||"",
    ...evaluarEstadoVinculoHistorico(f,cuentas,porMovimiento.get(String(f._id)))
   }));
   // El cursor proviene de la última fila efectivamente entregada, nunca del
   // centinela (limite+1); así no se salta ningún movimiento histórico.
   const siguienteCursor=truncado&&visibles.length?String(visibles[visibles.length-1]._id):null;
   return {soloLectura:true,modificaSaldos:false,vinculaAutomaticamente:false,
    requiereConfirmacionIndividual:true,truncado,siguienteCursor,movimientos,
    advertencia:"El nombre de una cuenta no constituye evidencia suficiente para vincular automáticamente un asiento histórico."};
  },{readConcern:{level:"snapshot"},readPreference:"primary"});
 }finally{await session.endSession();}
}
module.exports={evaluarCandidatoVinculo,evaluarEstadoVinculoHistorico,indexarVinculosHistoricosV81,diagnosticarVinculosHistoricosV81,cursorHistoricoValidoV81};
