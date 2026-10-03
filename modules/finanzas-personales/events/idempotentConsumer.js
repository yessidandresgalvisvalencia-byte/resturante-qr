"use strict";
const Evento=require("../models/eventoProcesadoPersonal.model");
async function procesarUnaVez({consumidor,event},handler){
 if(!consumidor||typeof handler!=="function"||!event?.eventId||!event?.eventName||!event?.usuarioId)throw new TypeError("Consumidor/evento inválido");
 try{await Evento.create({consumidor,eventId:event.eventId,eventName:event.eventName,usuarioId:event.usuarioId});}
 catch(e){if(e?.code===11000)return{procesado:false,duplicado:true};throw e;}
 try{const resultado=await handler(event);return{procesado:true,duplicado:false,resultado};}
 catch(e){await Evento.deleteOne({consumidor,eventId:event.eventId});throw e;}
}
module.exports={procesarUnaVez};
