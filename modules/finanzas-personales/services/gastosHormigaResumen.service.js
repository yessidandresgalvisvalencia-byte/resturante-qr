"use strict";
const Transaccion=require("../models/TransaccionPersonal");
const {clasificar}=require("./colombiaFinanciero.service");
const TZ="America/Bogota";
const MAX_MOVIMIENTOS_CONSULTA=5000; // límite por usuario y período; jamás publicar sumas truncadas.
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
 if(tx.estado!=="ACTIVA")throw new Error("INTEGRIDAD_HORMIGA: estado financiero no confirmado");
 const clase=clasificar(tx.concepto||"","GASTO");
 if(clase==="Deuda"||clase==="Gastos fijos")return false;
 return clase==="Gastos hormiga"||String(tx.categoria||"").trim().toLowerCase()==="gastos hormiga";
}
const MEDIOS_CAJA=new Set(["EFECTIVO","DEBITO","TRANSFERENCIA","PSE","OTRO"]);
function medioHormigaVerificado(tx){
 if(!esConsumoHormiga(tx))return null;
 if(tx.medioPago==="CREDITO")return "CREDITO";
 if(MEDIOS_CAJA.has(tx.medioPago)){
  if(tx.impactoCaja===false)return null;
  return "CAJA";
 }
 throw new Error("INTEGRIDAD_HORMIGA: medio de pago desconocido, no se puede afirmar salida de caja");
}
function esHormiga(tx){return medioHormigaVerificado(tx)==="CAJA";}
function esHormigaCredito(tx){return medioHormigaVerificado(tx)==="CREDITO";}
function resumir(transacciones,ahora=new Date()){
 if(!Array.isArray(transacciones))throw new TypeError("Se requiere lista de movimientos");
 const r=limites(ahora);
 let semana=0,mes=0,cantidadSemana=0,cantidadMes=0,creditoSemana=0,creditoMes=0,cantidadCreditoSemana=0,cantidadCreditoMes=0;
 const vistos=new Map();
 for(const tx of transacciones){
  if(!tx||typeof tx!=="object"||tx.tipo!=="GASTO")
   throw new Error("INTEGRIDAD_HORMIGA: registro de gasto incompleto o tipo contradictorio");
  const medio=medioHormigaVerificado(tx);
  if(medio===null)continue;
  const esCaja=medio==="CAJA";
  if(tx.moneda!=null&&tx.moneda!=="COP")throw new Error("INTEGRIDAD_HORMIGA: moneda distinta de COP");
  if(!Number.isSafeInteger(tx.montoMinor)||tx.montoMinor<=0)throw new TypeError("Monto hormiga inválido");
  if(tx.fecha===null||tx.fecha===undefined||tx.fecha==="")throw new TypeError("Fecha hormiga inválida");
  const fecha=new Date(tx.fecha);
  if(Number.isNaN(fecha.getTime()))throw new TypeError("Fecha hormiga inválida");
  const id=tx._id==null?"":String(tx._id);
  if(!id||id==="[object Object]")throw new Error("INTEGRIDAD_HORMIGA: movimiento sin identificador verificable");
  const firma=JSON.stringify([fecha.toISOString(),tx.moneda??"COP",tx.montoMinor,tx.concepto,tx.categoria,tx.estado,tx.impactoCaja,tx.medioPago]);
  if(vistos.has(id)){
   if(vistos.get(id)!==firma)throw new Error("INTEGRIDAD_HORMIGA: movimiento duplicado con datos contradictorios");
   continue;
  }
  vistos.set(id,firma);
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
 // Primero verificar la suma total; no operar con enteros fuera de rango seguro.
 const consumoTotalSemanaMinor=semana+creditoSemana;
 const consumoTotalMesMinor=mes+creditoMes;
 if(!Number.isSafeInteger(consumoTotalSemanaMinor)||!Number.isSafeInteger(consumoTotalMesMinor))
  throw new RangeError("Consumo hormiga total excede rango monetario seguro");
 // Prorrateo entero reconciliado: el peso residual se asigna al mayor resto.
 // Caja + crédito = total diario, sin redondeos que descuadren un peso.
 const promedioDiarioConsumoMinor=Math.floor(consumoTotalSemanaMinor/7);
 const baseCaja=Math.floor(semana/7);
 const baseCredito=Math.floor(creditoSemana/7);
 const residuo=promedioDiarioConsumoMinor-baseCaja-baseCredito;
 const promedioDiarioCajaMinor=baseCaja+(residuo>0&&semana%7>=creditoSemana%7?1:0);
 const promedioDiarioCreditoMinor=promedioDiarioConsumoMinor-promedioDiarioCajaMinor;
 return {periodo:"ULTIMOS_7_DIAS_Y_MES_COLOMBIA",semanaMinor:semana,mesMinor:mes,
  consumoTotalSemanaMinor,consumoTotalMesMinor,
  promedioDiarioCajaMinor,promedioDiarioCreditoMinor,
  promedioDiarioConsumoMinor,
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
  .select("_id fecha tipo moneda montoMinor categoria concepto estado impactoCaja medioPago")
  .limit(MAX_MOVIMIENTOS_CONSULTA+1).lean();
 if(!Array.isArray(transacciones)||transacciones.length>MAX_MOVIMIENTOS_CONSULTA)
  throw new Error("INTEGRIDAD_HORMIGA: consulta excede límite verificable; no se publica resumen parcial");
 return resumir(transacciones,ahora);
}
module.exports={obtener,resumir,esHormiga,esHormigaCredito,limites};
