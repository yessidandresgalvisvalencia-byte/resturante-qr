"use strict";
const {auditarCompensaciones}=require("./auditarCompensacionesPersonal.service");
const {eventoCompensatorio}=require("./eventoCompensatorioPersonal.service");
const ERROR="INTEGRIDAD_LEDGER: no se puede preparar compensación";
function conflicto(){throw Object.assign(new Error(ERROR),{statusCode:409});}
// Solo prepara una propuesta determinística: NO escribe en Mongo, cuentas ni outbox.
// El futuro ejecutor ACID debe repetir esta comprobación DENTRO de la transacción
// y hacer compare-and-swap del cursor junto al evento y al delta de caja.
function prepararCompensacion({usuarioId,originales,eventos,cursor,movimientoId,tipo,cambios={},idempotencyKey,fechaISO}){
 let auditoria;
 try{auditoria=auditarCompensaciones({usuarioId,originales,eventos,cursor});}
 catch(_){conflicto();}
 if(!Array.isArray(eventos)||eventos.some(e=>e.idempotencyKey===idempotencyKey))conflicto();
 const estado=auditoria.estados.find(e=>e.movimientoId===movimientoId);
 if(!estado||estado.anulado||auditoria.secuencia>=Number.MAX_SAFE_INTEGER)conflicto();
 let propuesta;
 try{
  propuesta=eventoCompensatorio({
   original:estado.actual,tipo,cambios,idempotencyKey,fechaISO,
   prevHash:auditoria.hashActual,secuencia:auditoria.secuencia+1
  });
 }catch(_){conflicto();}
 return Object.freeze({evento:propuesta,esperado:Object.freeze({
  usuarioId,secuencia:auditoria.secuencia,hashActual:auditoria.hashActual
 })});
}
module.exports={prepararCompensacion};
