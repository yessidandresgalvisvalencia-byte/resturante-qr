"use strict";
// Auditoría pura: no reescribe reservas ni interpreta correcciones como caja.
// Un resultado con discrepancias nunca se usa en Disponible Hoy.
const {periodoRecurrenteColombia}=require("./vinculoRecurrenteV81.service");
const {comprobarPagosSinCompensacionesPendientes}=
 require("./guardiaCuotasCompensadasPersonal.service");
function fallo(m){throw Object.assign(new Error("AUDITORIA_RESERVAS: "+m),{statusCode:409});}
function auditarReservasRecurrencia({usuarioId,origen,pagos,reservas,eventos,cursor}){
 if(typeof usuarioId!=="string"||!usuarioId||!origen||!origen._id||
  String(origen.usuarioId)!==usuarioId||origen.impactoCaja!==false||
  origen.tipo!=="GASTO"||origen.cuentaId!=null||origen.cuenta!=="SIN_CAJA"||
  origen.estado!=="ACTIVA"||!origen.recurrente||
  !Number.isSafeInteger(origen.montoMinor)||origen.montoMinor<=0||
  !["DIARIA","SEMANAL","QUINCENAL","MENSUAL","ANUAL"].includes(origen.frecuencia)||
  !Array.isArray(pagos)||!Array.isArray(reservas)||!Array.isArray(eventos))
  fallo("parámetros incompletos o obligación no verificable");
 // Solo se aceptan listas completas leídas en un mismo snapshot Mongo.
 const ids=new Set(),suma=new Map(),limites=new Map(),anulados=[];
 for(const p of pagos){
  const id=String(p?._id??"");
  if(!p||!p._id||ids.has(id)||String(p.usuarioId)!==usuarioId||
   String(p.recurrenteOrigenId)!==String(origen._id)||
   p.tipo!=="GASTO"||![ "ACTIVA","ANULADA"].includes(p.estado)||
   p.impactoCaja!==true||!Number.isSafeInteger(p.montoMinor)||p.montoMinor<=0)
   fallo("abono duplicado o inconsistente");
  ids.add(id);
  if(!Number.isFinite(new Date(p.fecha).getTime())||
     new Date(p.fecha)<new Date(origen.fecha))fallo("fecha de abono inválida");
  const periodo=periodoRecurrenteColombia({
   fechaOrigen:origen.fecha,fechaPago:p.fecha,frecuencia:origen.frecuencia
  });
  const clave=periodo.inicio.toISOString();
  limites.set(clave,periodo.fin.toISOString());
  if(p.estado==="ANULADA"){anulados.push(id);continue;}
  const nuevo=(suma.get(clave)||0n)+BigInt(p.montoMinor);
  if(nuevo>BigInt(origen.montoMinor))fallo("sobrepago en el histórico");
  suma.set(clave,nuevo);
 }
 // La cadena puede contener eventos de otras transacciones del usuario,
 // pero debe ser válida desde génesis y coincidir con el cursor.
 let compensaciones=[];
 try{
  comprobarPagosSinCompensacionesPendientes({usuarioId,origen,
   pagos:pagos.filter(p=>p.estado==="ACTIVA"),eventos,cursor});
 }catch(e){
  if(e?.statusCode!==409)throw e;
  // No devolver cifras parciales ni un dictamen optimista cuando el
  // historial compensatorio falla: se bloquea toda la auditoría.
  fallo("cadena o compensación de abono no conciliada");
 }
 for(const e of eventos)if(ids.has(String(e.movimientoId)))
  compensaciones.push(String(e.movimientoId));
 if(compensaciones.length)fallo("compensación de abonos sin conciliar");
 const observadas=new Map(),anomalías=[];
 for(const r of reservas){
  const ri=new Date(r?.periodoInicio),rf=new Date(r?.periodoFin);
  if(!Number.isFinite(ri.getTime())||!Number.isFinite(rf.getTime()))
   fallo("fechas de reserva inválidas");
  const clave=ri.toISOString(),fin=rf.toISOString();
  if(String(r.usuarioId)!==usuarioId||
   String(r.origenId)!==String(origen._id)||
   observadas.has(clave)||!Number.isSafeInteger(r.reservadoMinor)||
   r.reservadoMinor<0||r.importeCuotaMinor!==origen.montoMinor)
   fallo("reserva inválida o duplicada");
  observadas.set(clave,true);
  const esperado=suma.get(clave)||0n;
  if(BigInt(r.reservadoMinor)!==esperado)
   anomalías.push({codigo:"RESERVA_DESCUADRADA",periodoInicio:clave,
    esperadoMinor:esperado.toString(),observadoMinor:String(r.reservadoMinor)});
  if(limites.has(clave)&&limites.get(clave)!==fin)
   anomalías.push({codigo:"PERIODO_INCORRECTO",periodoInicio:clave});
  if(!limites.has(clave)&&r.reservadoMinor!==0)
   anomalías.push({codigo:"RESERVA_SIN_ABONOS",periodoInicio:clave});
 }
 for(const [clave,monto] of suma)if(!observadas.has(clave))
  anomalías.push({codigo:"FALTA_RESERVA",periodoInicio:clave,
   esperadoMinor:monto.toString()});
 return {estado:anomalías.length?"REQUIERE_CONCILIACION":"COHERENTE",
  anomalías,abonosAnulados:anulados.length,periodosConAbonos:suma.size,
  soloLectura:true,aptoParaDisponibleHoy:false};
}
module.exports={auditarReservasRecurrencia};
