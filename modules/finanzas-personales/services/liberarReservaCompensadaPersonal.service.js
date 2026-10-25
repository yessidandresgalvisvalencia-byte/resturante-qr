"use strict";
const Transaccion=require("../models/TransaccionPersonal");
const Reserva=require("../models/reservaCuotaRecurrente.model");
const {consultarPeriodo}=require("./consultaCompensadaPersonal.service");
const {periodoRecurrenteColombia}=require("./vinculoRecurrenteV81.service");
const conflicto=mensaje=>Object.assign(new Error(mensaje),{statusCode:409});
// Solo dentro de la transacción que inserta el reverso y ajusta cuenta/outbox.
async function liberarReserva({usuarioId,fuente,montoMinor,session}){
 if(!session?.inTransaction())throw new TypeError("Transacción activa obligatoria");
 if(!Number.isSafeInteger(montoMinor)||montoMinor<=0)throw new TypeError("Abono inválido");
 const indices=await Reserva.collection.indexes();
 if(!indices.some(i=>i.unique===true&&!i.partialFilterExpression&&i.sparse!==true&&
   Object.keys(i.key).length===3&&i.key.usuarioId===1&&i.key.origenId===1&&i.key.periodoInicio===1))
  throw conflicto("Índice único de reservas no verificable");
 const origen=await Transaccion.findOne({_id:fuente.recurrenteOrigenId,usuarioId,
  tipo:"GASTO",recurrente:true,estado:"ACTIVA"}).session(session).lean();
 if(!origen||!Number.isSafeInteger(origen.montoMinor)||origen.montoMinor<=0)
  throw conflicto("Origen recurrente ausente o inconsistente");
 const {inicio,fin}=periodoRecurrenteColombia({fechaOrigen:origen.fecha,
  fechaPago:fuente.fecha,frecuencia:origen.frecuencia});
 const rows=await consultarPeriodo({usuarioId,desde:inicio.toISOString(),hasta:fin.toISOString(),tipo:"GASTO"},{session});
 let total=0n;let encontrado=false;
 for(const x of rows){
  if(String(x.recurrenteOrigenId)!==String(origen._id))continue;
  if(x.impactoCaja!==true||!Number.isSafeInteger(x.montoMinor)||x.montoMinor<=0)
   throw conflicto("Abonos recurrentes no verificables");
  total+=BigInt(x.montoMinor);
  if(String(x._id)===String(fuente._id)){encontrado=true;if(x.montoMinor!==montoMinor)throw conflicto("Abono desactualizado");}
 }
 if(!encontrado||total<BigInt(montoMinor)||total>BigInt(origen.montoMinor))
  throw conflicto("Total recurrente inconsistente con la obligación");
 const reserva=await Reserva.findOneAndUpdate({usuarioId,origenId:origen._id,
  periodoInicio:inicio,periodoFin:fin,importeCuotaMinor:origen.montoMinor,reservadoMinor:Number(total)},
  {$inc:{reservadoMinor:-montoMinor}},{session,returnDocument:"after"});
 if(!reserva)throw conflicto("Reserva recurrente desincronizada; requiere conciliación");
 return reserva;
}
module.exports={liberarReserva};
