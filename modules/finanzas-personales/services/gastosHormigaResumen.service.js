"use strict";
const Transaccion=require("../models/TransaccionPersonal");
const {clasificar}=require("./colombiaFinanciero.service");
const TZ="America/Bogota";
function fechaCivilUTC(fecha){
 if(!(fecha instanceof Date)||Number.isNaN(fecha.getTime()))throw new TypeError("Fecha inválida");
 const partes=new Intl.DateTimeFormat("en-CA",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(fecha);
 const p=Object.fromEntries(partes.map(x=>[x.type,x.value]));
 return Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day));
}
function limites(ahora=new Date()){
 const hoy=fechaCivilUTC(ahora),p=new Date(hoy);
 const primerMes=Date.UTC(p.getUTCFullYear(),p.getUTCMonth(),1);
 return {inicioSiete:new Date(hoy-6*86400000+5*3600000),inicioMes:new Date(primerMes+5*3600000),fin:ahora,
  inicioConsulta:new Date(Math.min(hoy-6*86400000,primerMes)+5*3600000)};
}
function esHormiga(tx){
 if(!tx||tx.tipo!=="GASTO"||tx.estado==="ANULADA"||tx.impactoCaja===false||tx.medioPago==="CREDITO")return false;
 const clase=clasificar(tx.concepto||"","GASTO");
 if(clase==="Deuda"||clase==="Gastos fijos")return false;
 return clase==="Gastos hormiga"||String(tx.categoria||"").trim().toLowerCase()==="gastos hormiga";
}
function resumir(transacciones,ahora=new Date()){
 if(!Array.isArray(transacciones))throw new TypeError("Se requiere lista de movimientos");
 const r=limites(ahora);
 let semana=0,mes=0,cantidadSemana=0,cantidadMes=0;
 const vistos=new Set();
 for(const tx of transacciones){
  if(!esHormiga(tx))continue;
  const id=tx._id==null?null:String(tx._id);
  if(id&&vistos.has(id))continue;
  if(id)vistos.add(id);
  if(!Number.isSafeInteger(tx.montoMinor)||tx.montoMinor<=0)throw new TypeError("Monto hormiga inválido");
  const fecha=new Date(tx.fecha);
  if(Number.isNaN(fecha.getTime())||fecha>ahora)continue;
  if(fecha>=r.inicioSiete){semana+=tx.montoMinor;cantidadSemana++;}
  if(fecha>=r.inicioMes){mes+=tx.montoMinor;cantidadMes++;}
  if(!Number.isSafeInteger(semana)||!Number.isSafeInteger(mes))throw new RangeError("Acumulado hormiga excede rango seguro");
 }
 return {periodo:"ULTIMOS_7_DIAS_Y_MES_COLOMBIA",semanaMinor:semana,mesMinor:mes,
  movimientosSemana:cantidadSemana,movimientosMes:cantidadMes,
  nota:"Las ventanas se solapan: los totales no deben sumarse. Solo gastos reales no anulados; se excluyen pagos de deuda y movimientos sin salida de caja.",
  accion:cantidadSemana>0?"Revisa los gastos pequeños de esta semana antes de repetirlos.":"Registra únicamente tus gastos reales para revisar el consumo hormiga."};
}
async function obtener(usuarioId,{ahora=new Date()}={}){
 if(!usuarioId)throw new TypeError("La identidad autenticada es obligatoria");
 const periodo=limites(ahora);
 const transacciones=await Transaccion.find({usuarioId,tipo:"GASTO",estado:{$ne:"ANULADA"},
  impactoCaja:{$ne:false},medioPago:{$ne:"CREDITO"},fecha:{$gte:periodo.inicioConsulta,$lte:periodo.fin}})
  .select("_id fecha tipo montoMinor categoria concepto estado impactoCaja medioPago").lean();
 return resumir(transacciones,ahora);
}
module.exports={obtener,resumir,esHormiga,limites};
