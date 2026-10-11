'use strict';
const mongoose=require('mongoose');
const Recibo=require('../../models/GrukEventoConsumido');
const VALID_EVENT=/^[-_a-zA-Z0-9:]{8,180}$/;
const VALID_NAME=/^[a-zA-Z][a-zA-Z0-9_-]{1,79}$/;
function invalid(code){return Object.assign(new Error(code),{statusCode:400});}
function crearProcesadorIdempotente({Receipt=Recibo,mongooseInstance=mongoose}={}){
 if(!Receipt?.create||!mongooseInstance?.startSession)throw new Error('DEPENDENCIAS_CONSUMIDOR_INVALIDAS');
 return async function procesar({empresaId,consumidor,eventId,aplicar}){
  if(!mongooseInstance.isValidObjectId(empresaId)||typeof consumidor!=='string'||!VALID_NAME.test(consumidor)||typeof eventId!=='string'||!VALID_EVENT.test(eventId)||typeof aplicar!=='function')throw invalid('CONSUMIDOR_EVENTO_INVALIDO');
  const scope={empresaId,consumidor,eventId};
  const session=await mongooseInstance.startSession();
  try{
   let applied=false;
   await session.withTransaction(async()=>{
    // Receipt and business effects share one transaction, so either both commit or neither does.
    const existing=await Receipt.findOne(scope).session(session).lean();
    if(existing)return;
    await Receipt.create([scope],{session});
    await aplicar({session,empresaId,consumidor,eventId});
    applied=true;
   },{readConcern:{level:'snapshot'},writeConcern:{w:'majority'}});
   return {applied,replayed:!applied};
  }catch(error){
   if(error?.code===11000||error?.hasErrorLabel?.('UnknownTransactionCommitResult')){
    const existing=await Receipt.findOne(scope).lean();
    if(existing)return {applied:false,replayed:true};
    throw Object.assign(new Error('CONSUMO_RESULTADO_INCIERTO'),{statusCode:503,cause:error});
   }
   throw error;
  }finally{await session.endSession();}
 };
}
module.exports={crearProcesadorIdempotente};
