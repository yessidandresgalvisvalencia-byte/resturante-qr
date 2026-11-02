"use strict";
const Transaccion=require("../models/TransaccionPersonal");
const Reserva=require("../models/reservaCuotaRecurrente.model");
const {consultarPeriodo}=require("./consultaCompensadaPersonal.service");
const {indiceExacto}=require("../security/auditoriaIndicesMongoV81.service");
const {periodoRecurrenteColombia,validarFechaPagoVinculado,validarNoDuplicarOrigenHoy}=require("./vinculoRecurrenteV81.service");
const conflicto=mensaje=>Object.assign(new Error(mensaje),{statusCode:409});
function crearRestauradorReserva({TransaccionModelo=Transaccion,ReservaModelo=Reserva,consultar=consultarPeriodo}={}){
 return async function restaurarReserva({usuarioId,fuente,montoMinor,session}){
  if(!session?.inTransaction?.())throw new TypeError("Transacción activa obligatoria");
  if(!fuente?.recurrenteOrigenId||fuente.tipo!=="GASTO"||fuente.recurrente||fuente.impactoCaja!==true||
   String(fuente.usuarioId)!==String(usuarioId)||!Number.isSafeInteger(montoMinor)||montoMinor<=0||fuente.montoMinor!==montoMinor)
   throw conflicto("Abono recurrente no verificable para restaurar");
  let indices;
  try{indices=await ReservaModelo.collection.indexes();}
  catch(_){throw Object.assign(new Error("Índice de reservas no disponible"),{statusCode:503});}
  if(!indiceExacto(indices,["usuarioId","origenId","periodoInicio"]))
   throw Object.assign(new Error("Índice único de reservas no verificable"),{statusCode:503});
  const origen=await TransaccionModelo.findOne({_id:fuente.recurrenteOrigenId,usuarioId,
   tipo:"GASTO",recurrente:true,estado:"ACTIVA",moneda:"COP"}).maxTimeMS(5000).session(session).lean();
  if(!origen||!Number.isSafeInteger(origen.montoMinor)||origen.montoMinor<=0||typeof origen.impactoCaja!=="boolean")
   throw conflicto("Origen recurrente ausente o inconsistente");
  validarFechaPagoVinculado({fechaPago:fuente.fecha,fechaOrigen:origen.fecha});
  validarNoDuplicarOrigenHoy({fechaPago:fuente.fecha,fechaOrigen:origen.fecha,origenImpactoCaja:origen.impactoCaja});
  const {inicio,fin}=periodoRecurrenteColombia({fechaOrigen:origen.fecha,fechaPago:fuente.fecha,frecuencia:origen.frecuencia});
  if(origen.impactoCaja&&new Date(origen.fecha)>=inicio&&new Date(origen.fecha)<fin)
   throw conflicto("El primer período recurrente ya está asentado en caja");
  const rows=await consultar({usuarioId,desde:inicio.toISOString(),hasta:fin.toISOString(),tipo:"GASTO"},{session});
  if(!Array.isArray(rows))throw conflicto("Lectura recurrente incompleta");
  let total=0n;
  for(const x of rows){
   if(String(x.recurrenteOrigenId)!==String(origen._id))continue;
   if(String(x._id)===String(fuente._id)||String(x.usuarioId)!==String(usuarioId)||x.impactoCaja!==true||
    !Number.isSafeInteger(x.montoMinor)||x.montoMinor<=0)throw conflicto("Abonos vigentes no verificables");
   total+=BigInt(x.montoMinor);
  }
  const siguiente=total+BigInt(montoMinor);
  if(siguiente>BigInt(origen.montoMinor))throw conflicto("La restauración supera el cupo de esta recurrencia");
  // Sin upsert ni reparación: el control existente debe coincidir exactamente
  // con el ledger compensado antes de reservar de nuevo el abono anulado.
  const reserva=await ReservaModelo.findOneAndUpdate({usuarioId,origenId:origen._id,periodoInicio:inicio,
   periodoFin:fin,importeCuotaMinor:origen.montoMinor,reservadoMinor:Number(total)},
   {$inc:{reservadoMinor:montoMinor}},{session,returnDocument:"after"});
  if(!reserva||reserva.reservadoMinor!==Number(siguiente))
   throw conflicto("Reserva recurrente desincronizada; requiere conciliación");
  return reserva;
 };
}
module.exports={crearRestauradorReserva,restaurarReserva:crearRestauradorReserva()};
