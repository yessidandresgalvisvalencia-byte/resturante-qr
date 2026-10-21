"use strict";
const {prepararCompensacion}=require("./prepararCompensacionPersonal.service");
const MAX=BigInt(Number.MAX_SAFE_INTEGER);
function conflicto(mensaje){throw Object.assign(new Error("COMPENSACION_NO_APLICABLE: "+mensaje),{statusCode:409});}
function enteroSeguro(importe,nombre){
 if(!Number.isSafeInteger(importe))conflicto(nombre+" no es un entero seguro");
 return BigInt(importe);
}
// PLAN PURO, SIN EFECTOS: no sustituye la transacción ACID ni actualiza saldos.
// saldoMinor debe proceder de la misma cuenta y snapshot usados por el futuro CAS.
function planificarCompensacionCaja({saldoMinor,permitirSaldoNegativo=false,...solicitud}){
 const saldo=enteroSeguro(saldoMinor,"saldoMinor");
 if(typeof permitirSaldoNegativo!=="boolean")conflicto("política de saldo inválida");
 const propuesta=prepararCompensacion(solicitud);
 const deltaTexto=propuesta.evento.deltaCajaMinor;
 if(!/^-?(0|[1-9][0-9]*)$/.test(deltaTexto))conflicto("delta inválido");
 const delta=BigInt(deltaTexto);
 const resultado=saldo+delta;
 if(resultado>MAX||resultado< -MAX)conflicto("desbordamiento monetario");
 if(!permitirSaldoNegativo&&resultado<0n)conflicto("saldo insuficiente");
 return Object.freeze({
  ...propuesta,
  saldoAnteriorMinor:saldo.toString(),
  deltaCajaMinor:delta.toString(),
  saldoPosteriorMinor:resultado.toString()
 });
}
module.exports={planificarCompensacionCaja};
