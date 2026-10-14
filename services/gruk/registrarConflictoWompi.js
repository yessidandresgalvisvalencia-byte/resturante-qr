"use strict";
const Conciliacion=require("../../models/GrukWompiConciliacion");
function registrarConflictoWompi({reference,transactionId,reason}){
 if(typeof reference!=="string"||!/^GRUK_PEDIDO_[a-f0-9-]{36}$/i.test(reference)||
    typeof transactionId!=="string"||!transactionId.trim()||transactionId.length>180||
    typeof reason!=="string"||!reason.trim()||reason.length>100){
   throw new Error("CONCILIACION_WOMPI_IDENTIDAD_INVALIDA");
 }
 return Conciliacion.findOneAndUpdate(
  {reference,transactionId},
  {$set:{reason,estado:"PENDIENTE",ultimoIntentoAt:new Date(),resueltoAt:null},$inc:{intentos:1}},
  {upsert:true,new:true,setDefaultsOnInsert:true}
 );
}
module.exports={registrarConflictoWompi};
