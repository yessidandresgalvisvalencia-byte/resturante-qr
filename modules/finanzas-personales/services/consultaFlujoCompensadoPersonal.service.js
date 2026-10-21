"use strict";
const mongoose=require("mongoose");
const Transaccion=require("../models/TransaccionPersonal");
const Evento=require("../models/EventoCompensatorioPersonal");
const Cursor=require("../models/CursorCompensacionPersonal");
const {flujoCompensadoPuro}=require("./flujoCompensadoPersonal.service");
const LIMITE=10000,GENESIS="0".repeat(64);
function errorVolumen(){throw Object.assign(new Error("Historial demasiado extenso para verificación completa; requiere reconciliación"),{statusCode:503});}
function integridad(mensaje){throw Object.assign(new Error("INTEGRIDAD_LEDGER: "+mensaje),{statusCode:409});}
function crearConsultaFlujoCompensado({
 TransaccionModelo=Transaccion,EventoModelo=Evento,CursorModelo=Cursor,
 nuevaSesion=()=>mongoose.startSession()
}={}){
 return async function consultar(usuarioId,{desde,hasta}={}){
  if(!mongoose.isValidObjectId(usuarioId))
   throw Object.assign(new Error("Identidad no válida"),{statusCode:400});
  const inicio=new Date(desde),fin=new Date(hasta);
  if(!desde||!hasta||!Number.isFinite(inicio.getTime())||
   !Number.isFinite(fin.getTime())||inicio>=fin)
   throw Object.assign(new Error("Periodo inválido"),{statusCode:400});
  // Leer MOVIMIENTOS, EVENTOS y CURSOR en el MISMO snapshot. Nunca usar
  // Promise.all con operaciones paralelas sobre la misma sesión Mongo.
  const session=await nuevaSesion();
  try{
   let resultado;
   await session.withTransaction(async()=>{
    const movimientos=await TransaccionModelo.find({
     usuarioId:new mongoose.Types.ObjectId(usuarioId)
    }).limit(LIMITE+1).session(session).lean();
    const eventos=await EventoModelo.find({usuarioId:String(usuarioId)})
     .sort({secuencia:1}).limit(LIMITE+1).session(session).lean();
    const cursor=await CursorModelo.findById(String(usuarioId)).session(session).lean();
    if(!Array.isArray(movimientos)||!Array.isArray(eventos)||
     movimientos.length>LIMITE||eventos.length>LIMITE)errorVolumen();
    // El extremo de cadena es parte de la integridad. Una cadena truncada
    // podría ser criptográficamente válida, pero incompatible con el cursor.
    if(cursor){
     if(!Number.isSafeInteger(cursor.secuencia)||
      cursor.secuencia!==eventos.length||
      cursor.hashActual!==(eventos.length?eventos.at(-1).hashActual:GENESIS))
       integridad("cursor y eventos desincronizados");
    }else if(eventos.length)integridad("eventos sin cursor");
    resultado=flujoCompensadoPuro({
     usuarioId:String(usuarioId),movimientos,eventos,desde:inicio,hasta:fin
    });
   },{readConcern:{level:"snapshot"},readPreference:"primary"});
   return resultado;
  }finally{await session.endSession();}
 };
}
module.exports={crearConsultaFlujoCompensado,LIMITE};
