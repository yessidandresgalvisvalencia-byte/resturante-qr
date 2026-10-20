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
function esConsumoHormiga(tx){
 if(!tx||tx.tipo!=="GASTO"||tx.estado==="ANULADA")return false;
 const clase=clasificar(tx.concepto||"","GASTO");
 if(clase==="Deuda"||clase==="Gastos fijos")return false;
 return clase==="Gastos hormiga"||String(tx.categoria||"").trim().toLowerCase()==="gastos hormiga";
}
function esHormiga(tx){return esConsumoHormiga(tx)&&tx.medioPago!=="CREDITO"&&tx.impactoCaja!==false;}
function esHormigaCredito(tx){return esConsumoHormiga(tx)&&tx.medioPago==="CREDITO";}
function resumir(transacciones,ahora=new Date()){
 if(!Array.isArray(transacciones))throw new TypeError("Se requiere lista de movimientos");
 const r=limites(ahora);
 let semana=0,mes=0,cantidadSemana=0,cantidadMes=0,creditoSemana=0,creditoMes=0,cantidadCreditoSemana=0,cantidadCreditoMes=0;
 const vistos=new Map();
 for(const tx of transacciones){
  const esCaja=esHormiga(tx),esCredito=esHormigaCredito(tx);
  if(!esCaja&&!esCredito)continue;
  if(!Number.isSafeInteger(tx.montoMinor)||tx.montoMinor<=0)throw new TypeError("Monto hormiga inválido");
  if(tx.fecha===null||tx.fecha===undefined||tx.fecha==="")throw new TypeError("Fecha hormiga inválida");
  const fecha=new Date(tx.fecha);
  if(Number.isNaN(fecha.getTime()))throw new TypeError("Fecha hormiga inválida");
  const id=tx._id==null?null:String(tx._id);
  const firma=JSON.stringify([fecha.toISOString(),tx.montoMinor,tx.concepto,tx.categoria,tx.estado,tx.impactoCaja,tx.medioPago]);
  if(id&&vistos.has(id)){
   if(vistos.get(id)!==firma)throw new Error("INTEGRIDAD_HORMIGA: movimiento duplicado con datos contradictorios");
   continue;
  }
  if(id)vistos.set(id,firma);
  if(fecha>ahora)continue;
  if(fecha>=r.inicioSiete){
   if(esCaja){semana+=tx.montoMinor;cantidadSemana++;}
   else {creditoSemana+=tx.montoMinor;cantidadCreditoSemana++;}
  }
  if(fecha>=r.inicioMes){
   if(esCaja){mes+=tx.montoMinor;cantidadMes++;}
   else {creditoMes+=tx.montoMinor;cantidadCreditoMes++;}
  }
  if(![semana,mes,creditoSemana,creditoMes].every(Number.isSafeInteger))
   throw new RangeError("Acumulado hormiga excede rango seguro");
 }
 const consumoTotalSemanaMinor=semana+creditoSemana;
 const consumoTotalMesMinor=mes+creditoMes;
 if(!Number.isSafeInteger(consumoTotalSemanaMinor)||!Number.isSafeInteger(consumoTotalMesMinor))
  throw new RangeError("Consumo hormiga total excede rango monetario seguro");
 return {periodo:"ULTIMOS_7_DIAS_Y_MES_COLOMBIA",semanaMinor:semana,mesMinor:mes,
  consumoTotalSemanaMinor,consumoTotalMesMinor,
  movimientosSemana:cantidadSemana,movimientosMes:cantidadMes,
  creditoSemanaMinor:creditoSemana,creditoMesMinor:creditoMes,
  movimientosCreditoSemana:cantidadCreditoSemana,movimientosCreditoMes:cantidadCreditoMes,
  nota:"Las ventanas se solapan: los totales no deben sumarse. Caja: solo salidas efectivas. Crédito: consumo que aumenta deuda, separado de caja. Los pagos posteriores de tarjeta no se cuentan como nuevos consumos.",
  accion:cantidadSemana+cantidadCreditoSemana>0?"Revisa tus compras pequeñas, incluidas las que pagaste con tarjeta, antes de repetirlas.":"Registra únicamente tus gastos reales para revisar el consumo hormiga."};
}
async function obtener(usuarioId,{ahora=new Date()}={}){
 if(!usuarioId)throw new TypeError("La identidad autenticada es obligatoria");
 const periodo=limites(ahora);
 const transacciones=await Transaccion.find({usuarioId,tipo:"GASTO",estado:{$ne:"ANULADA"},
  fecha:{$gte:periodo.inicioConsulta,$lte:periodo.fin}})
  .select("_id fecha tipo montoMinor categoria concepto estado impactoCaja medioPago").lean();
 return resumir(transacciones,ahora);
}
module.exports={obtener,resumir,esHormiga,esHormigaCredito,limites};
