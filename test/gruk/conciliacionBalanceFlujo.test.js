"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const src=fs.readFileSync(require.resolve("../../modules/finanzas-personales/services/homePersonal.service"),"utf8");
test("balance contra flujo posee reconciliación aritmética explícita",()=>{
 assert.match(src,/balancePeriodoMinor\+diferenciaBalanceFlujoMinor!==flujoRealizadoMinor/);
 assert.match(src,/gastosSinSalidaCajaMinor-pagosDeudaRegistradosMinor\+cobrosRecibidosMinor/);
});
test("ingresos normales no se suponen cobros",()=>{
 assert.match(src,/x\.tipo==="INGRESO"/);
 assert.match(src,/x\.tipo==="COBRO_PRESTAMO"/);
});
