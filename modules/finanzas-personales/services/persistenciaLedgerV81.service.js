"use strict";
const mongoose=require("mongoose");
const Evento=require("../models/eventoV81.model");
const Cabeza=require("../models/cabezaV81.model");
const {crearEvento,GENESIS}=require("./cadenaEventosV81.service");
// Debe invocarse únicamente en una transacción MongoDB con writeConcern majority.
// No registra efectos en caja: la integración contable requiere conciliación previa.
async function anexarEventoV81(usuarioId,datos){
 if(!mongoose.isValidObjectId(usuarioId))throw new TypeError("Usuario inválido");
 const userId=String(usuarioId);
 const session=await mongoose.startSession();
 try {
  let evento;
  await session.withTransaction(async()=>{
   let cabeza=await Cabeza.findOne({usuarioId}).session(session).lean();
   if(!cabeza){
    try {
     await Cabeza.create([{usuarioId,version:0,hashActual:GENESIS}],{session});
    } catch(e) { throw e; } // Un alta concurrente falla: el llamador reintenta toda la operación.
    cabeza={version:0,hashActual:GENESIS};
   }
   const version=cabeza.version+1;
   evento=crearEvento({...datos,userId,version},cabeza.hashActual);
   // Comparación y sustitución: solo una escritura puede avanzar esta versión.
   const update=await Cabeza.updateOne({usuarioId,version:cabeza.version,hashActual:cabeza.hashActual},
     {$set:{version,hashActual:evento.hashActual}},{session});
   if(update.modifiedCount!==1)throw Object.assign(new Error("Conflicto de concurrencia en ledger V81"),{statusCode:409});
   await Evento.create([{usuarioId,eventId:evento.id,version,tipo:evento.tipo,
    montoCentavos:evento.montoCentavos.toString(),fechaContable:evento.fechaContable,
    timestamp:evento.timestamp,corrigeId:evento.corrigeId||null,motivo:evento.motivo||null,
    tipoCorregido:evento.tipoCorregido||null,hashAnterior:evento.hashAnterior,hashActual:evento.hashActual}],{session});
  },{readConcern:{level:"snapshot"},writeConcern:{w:"majority"},readPreference:"primary"});
  return evento;
 } finally {await session.endSession();}
}
module.exports={anexarEventoV81};
