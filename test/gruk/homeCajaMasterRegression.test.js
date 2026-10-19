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

test("Disponible Hoy no autoriza gasto positivo si la conciliación es insuficiente",()=>{
 const {resolverSaldoAsesor,crearDecisionDisponibleHoy}=require("../../modules/finanzas-personales/services/homePersonal.service");
 const noVerificado=resolverSaldoAsesor({
  saldoVerificado:false,liquidezMinor:850000,
  hayMovimientosLedger:true,saldoDerivadoLedgerMinor:850000
 });
 assert.equal(noVerificado.requiereReconciliacion,true);
 assert.notEqual(noVerificado.confiabilidad,"VERIFICADO");
 const decision=crearDecisionDisponibleHoy({
  disponibleHoyMinor:600000,aptoParaDisponibleHoy:false,corte:new Date("2026-10-18T12:00:00Z")
 });
 assert.equal(decision.montoMinor,0);
 assert.equal(decision.requiereReconciliacion,true);
 assert.equal(decision.confianza,"NO_VERIFICADO");
 assert.equal(decision.fuente,"SALDO_PENDIENTE_CONCILIACION");
 const apta=crearDecisionDisponibleHoy({
  disponibleHoyMinor:600000,aptoParaDisponibleHoy:true,corte:new Date("2026-10-18T12:00:00Z")
 });
 assert.equal(apta.montoMinor,600000);
});
