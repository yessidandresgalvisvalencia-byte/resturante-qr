"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs");
const src=fs.readFileSync(require.resolve("../../modules/finanzas-personales/services/homePersonal.service"),"utf8");
test("nunca excluye gastos por nombre de producto",()=>assert.doesNotMatch(src,/\/moto\/i/));
test("cuotas pendientes compensan solamente pagos de su misma deuda",()=>{
 assert.match(src,/pagosPorDeuda\.get\(String\(d\._id\)\)/);
 assert.match(src,/Math\.max\(0,cuotaDelPeriodo/);
});
test("liquidez no conciliada no se presenta como saldo disponible",()=>{
 assert.match(src,/pat\.saldoVerificado\?pat\.liquidezMinor-cuotasPendientesMesMinor:null/);
});
