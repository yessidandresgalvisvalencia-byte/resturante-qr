"use strict";
const mongoose=require("mongoose");
const Transaccion=require("../models/TransaccionPersonal");
const Evento=require("../models/EventoCompensatorioPersonal");
const {flujoCompensadoPuro}=require("./flujoCompensadoPersonal.service");
const LIMITE=10000;
function errorVolumen(){throw Object.assign(new Error("Historial demasiado extenso para verificación completa; requiere reconciliación"),{statusCode:503});}
function crearConsultaFlujoCompensado({TransaccionModelo=Transaccion,EventoModelo=Evento}={}){
 return async function consultar(usuarioId,{desde,hasta}={}){
  if(!mongoose.isValidObjectId(usuarioId))
   throw Object.assign(new Error("Identidad no válida"),{statusCode:400});
  const inicio=new Date(desde),fin=new Date(hasta);
  if(!desde||!hasta||!Number.isFinite(inicio.getTime())||
   !Number.isFinite(fin.getTime())||inicio>=fin)
   throw Object.assign(new Error("Periodo inválido"),{statusCode:400});
  // La proyección exige toda la historia del usuario, NO solo la ventana:
  // una corrección anterior al período puede afectar una consulta posterior.
  // Hasta tener checkpoints seguros se bloquea un historial excesivo.
  const [movimientos,eventos]=await Promise.all([
   TransaccionModelo.find({usuarioId:new mongoose.Types.ObjectId(usuarioId)})
    .limit(LIMITE+1).lean(),
   EventoModelo.find({usuarioId:String(usuarioId)})
    .sort({secuencia:1}).limit(LIMITE+1).lean()
  ]);
  if(!Array.isArray(movimientos)||!Array.isArray(eventos)||
   movimientos.length>LIMITE||eventos.length>LIMITE)errorVolumen();
  return flujoCompensadoPuro({
   usuarioId:String(usuarioId),movimientos,eventos,desde:inicio,hasta:fin
  });
 };
}
module.exports={crearConsultaFlujoCompensado,LIMITE};
