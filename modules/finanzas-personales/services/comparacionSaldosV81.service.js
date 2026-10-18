"use strict";
const {conciliarContraReferenciaV81}=require("./conciliacionV81.service");
// Solo coteja saldos ya obtenidos: no migra datos ni confunde ledger nuevo con histórico.
function compararSaldosV81({saldoV81Centavos,saldoHistoricoCentavos,integridadV81}){
 if(integridadV81!=="VERIFICADA")return Object.freeze({estado:"NO_CONFIABLE",coincide:null});
 if(typeof saldoV81Centavos!=="string"||! /^-?(?:0|[1-9]\d*)$/.test(saldoV81Centavos))
  throw new TypeError("Saldo V81 inválido");
 if(typeof saldoHistoricoCentavos!=="string"||! /^-?(?:0|[1-9]\d*)$/.test(saldoHistoricoCentavos))
  return Object.freeze({estado:"SIN_REFERENCIA",coincide:null});
 const resultado=conciliarContraReferenciaV81({saldoCentavos:BigInt(saldoV81Centavos)},BigInt(saldoHistoricoCentavos));
 return Object.freeze({estado:resultado.coincide?"COINCIDE":"DIFERENCIA",coincide:resultado.coincide,diferenciaCentavos:resultado.diferenciaCentavos.toString()});
}
module.exports={compararSaldosV81};
