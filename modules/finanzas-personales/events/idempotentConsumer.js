"use strict";
const mongoose=require("mongoose");
const Evento=require("../models/eventoProcesadoPersonal.model");
function validar(consumidor,event,handler){if(!consumidor||typeof handler!=="function"||!event?.eventId||!event?.eventName||!event?.usuarioId)throw new TypeError("Consumidor/evento inválido");}
async function procesarUnaVez({consumidor,event},handler){
 validar(consumidor,event,handler);
 try{await Evento.create({consumidor,eventId:event.eventId,eventName:event.eventName,usuarioId:event.usuarioId});}
 catch(e){if(e?.code===11000)return{procesado:false,duplicado:true};throw e;}
 try{const resultado=await handler(event);return{procesado:true,duplicado:false,resultado};}
 catch(e){await Evento.deleteOne({consumidor,eventId:event.eventId});throw e;}
}
async function procesarUnaVezMongo({consumidor,event},handler){
 validar(consumidor,event,handler);const session=await mongoose.startSession();let salida={procesado:false,duplicado:false};
 try{await session.withTransaction(async()=>{try{await Evento.create([{consumidor,eventId:event.eventId,eventName:event.eventName,usuarioId:event.usuarioId}],{session});}catch(e){if(e?.code===11000){salida={procesado:false,duplicado:true};return;}throw e;}const resultado=await handler(event,session);salida={procesado:true,duplicado:false,resultado};},{readConcern:{level:"snapshot"},writeConcern:{w:"majority"},readPreference:"primary"});return salida;}finally{await session.endSession();}
}
module.exports={procesarUnaVez,procesarUnaVezMongo};
