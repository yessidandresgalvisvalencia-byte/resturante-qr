"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {compararSaldosV81}=require("../../modules/finanzas-personales/services/comparacionSaldosV81.service");
test("Compara saldos exactos en centavos sin mezclar libros",()=>{
 assert.deepEqual(compararSaldosV81({saldoV81Centavos:"100030",saldoHistoricoCentavos:"100030",integridadV81:"VERIFICADA"}),{estado:"COINCIDE",coincide:true,diferenciaCentavos:"0"});
 assert.deepEqual(compararSaldosV81({saldoV81Centavos:"-30",saldoHistoricoCentavos:"-31",integridadV81:"VERIFICADA"}),{estado:"DIFERENCIA",coincide:false,diferenciaCentavos:"1"});
});
test("Bloquea datos no confiables y referencias inexistentes",()=>{
 assert.deepEqual(compararSaldosV81({saldoV81Centavos:"100",saldoHistoricoCentavos:"100",integridadV81:"FALLIDA"}),{estado:"NO_CONFIABLE",coincide:null});
 assert.deepEqual(compararSaldosV81({saldoV81Centavos:"100",integridadV81:"VERIFICADA"}),{estado:"SIN_REFERENCIA",coincide:null});
 assert.throws(()=>compararSaldosV81({saldoV81Centavos:"1.2",saldoHistoricoCentavos:"1",integridadV81:"VERIFICADA"}),TypeError);
});
