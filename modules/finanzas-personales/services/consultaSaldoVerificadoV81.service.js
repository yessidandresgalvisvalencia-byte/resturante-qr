"use strict";
const mongoose=require("mongoose");
const Evento=require("../models/eventoV81.model");
const Cabeza=require("../models/cabezaV81.model");
const {verificarCadena}=require("./cadenaEventosV81.service");
const {proyectarSaldoV81}=require("./conciliacionV81.service");
// La verificación y la proyección comparten la misma instantánea de MongoDB.
async function consultarSaldoVerificadoV81(usuarioId){
 if(!mongoose.isValidObjectId(usuarioId))throw new TypeError("Usuario inválido");
 const session=await mongoose.startSession();
 try{
  return await session.withTransaction(async()=>{
   const cabeza=await Cabeza.findOne({usuarioId}).session(session).lean();
   const rows=await Evento.find({usuarioId}).sort({version:1}).session(session).lean();
   if(!cabeza||!Number.isSafeInteger(cabeza.version)||rows.length!==cabeza.version)
    return {integridad:"FALLIDA",cantidad:rows.length};
   let eventos;
   try{eventos=rows.map(e=>({id:e.eventId,userId:String(e.usuarioId),version:e.version,tipo:e.tipo,montoCentavos:BigInt(e.montoCentavos),fechaContable:e.fechaContable,timestamp:e.timestamp,corrigeId:e.corrigeId,motivo:e.motivo,tipoCorregido:e.tipoCorregido,hashAnterior:e.hashAnterior,hashActual:e.hashActual}));}
   catch(_){return {integridad:"FALLIDA",cantidad:rows.length};}
   if(!verificarCadena(eventos,cabeza.hashActual))return {integridad:"FALLIDA",cantidad:rows.length};
   try{
    const proyeccion=proyectarSaldoV81(eventos);
    return {integridad:"VERIFICADA",cantidad:rows.length,saldoCentavos:proyeccion.saldoCentavos.toString(),ingresosCentavos:proyeccion.ingresosCentavos.toString(),gastosCentavos:proyeccion.gastosCentavos.toString()};
   }catch(_){return {integridad:"NO_CONCILIABLE",cantidad:rows.length};}
  },{readConcern:{level:"snapshot"},readPreference:"primary"});
 }finally{await session.endSession();}
}
module.exports={consultarSaldoVerificadoV81};
