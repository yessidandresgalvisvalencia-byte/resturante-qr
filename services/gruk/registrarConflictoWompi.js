"use strict";
const Conciliacion=require("../../models/GrukWompiConciliacion");
async function registrarConflictoWompi({reference,transactionId,reason}){
 if(typeof reference!=="string"||!/^GRUK_PEDIDO_[a-f0-9-]{36}$/i.test(reference)||
    typeof transactionId!=="string"||!transactionId.trim()||transactionId.length>180||
    typeof reason!=="string"||!reason.trim()||reason.length>100){
   throw new Error("CONCILIACION_WOMPI_IDENTIDAD_INVALIDA");
 }
 const filter={reference,transactionId};
 const update={$set:{reason,estado:"PENDIENTE",ultimoIntentoAt:new Date(),resueltoAt:null},$inc:{intentos:1}};
 try {
  return await Conciliacion.findOneAndUpdate(filter,update,{upsert:true,new:true,setDefaultsOnInsert:true});
 } catch(error) {
  // Concurrent upserts can lose the unique-index race. Retry as an update,
  // never create a second record and never swallow unrelated database errors.
  if(error?.code!==11000)throw error;
  const recovered=await Conciliacion.findOneAndUpdate(filter,update,{new:true});
  if(!recovered)throw error;
  return recovered;
 }
}
module.exports={registrarConflictoWompi};
