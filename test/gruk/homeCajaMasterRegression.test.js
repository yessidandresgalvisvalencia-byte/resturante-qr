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

test("la interfaz no publica Disponible Hoy sin aptitud explícita",()=>{
 const html=fs.readFileSync(require.resolve("../../public/finanzas-personales.html"),"utf8");
 const js=fs.readFileSync(require.resolve("../../public/finanzas-personales.js"),"utf8");
 assert.match(html,/id="hDisponibleHoy">Pendiente de conciliación/);
 assert.match(html,/Disponible después de compromisos \(no es autorización de gasto\)/);
 assert.match(js,/home\.asesor\?\.aptoParaDisponibleHoy===true&&Number\.isSafeInteger\(home\.asesor\?\.disponibleHoyMinor\)/);
 assert.ok(js.includes('home.asesor.disponibleHoyMinor>=0&&home.verdadFinanciera?.disponibleHoy?.montoMinor===home.asesor.disponibleHoyMinor'));
 assert.ok(js.includes('home.verdadFinanciera.disponibleHoy.requiereReconciliacion===false'));
 assert.ok(js.includes('home.verdadFinanciera.disponibleHoy.confianza==="ALTA"?money(home.asesor.disponibleHoyMinor):"Pendiente de conciliación"'));
 assert.match(js,/\["hDisponibleHoy","disponibleHoy"\]/);
 assert.match(js,/\["hDisponibleHoy","hDisponible","hComprometido"/);
});

test("un saldo marcado verificado pero inseguro jamás autoriza dinero para gastar",()=>{
 const {resolverSaldoAsesor,crearDecisionDisponibleHoy}=require("../../modules/finanzas-personales/services/homePersonal.service");
 for(const liquidezMinor of [NaN,Infinity,-1,0.1,"850000",Number.MAX_SAFE_INTEGER+1,null,undefined]){
  const estado=resolverSaldoAsesor({saldoVerificado:true,liquidezMinor});
  assert.equal(estado.confiabilidad,"NO_VERIFICADO",String(liquidezMinor));
  assert.equal(estado.montoMinor,0,String(liquidezMinor));
  assert.equal(estado.requiereReconciliacion,true);
  const decision=crearDecisionDisponibleHoy({disponibleHoyMinor:0,
   aptoParaDisponibleHoy:estado.confiabilidad==="VERIFICADO"&&!estado.requiereReconciliacion,
   corte:new Date("2026-10-18T12:00:00Z")});
  assert.equal(decision.montoMinor,0);
  assert.equal(decision.requiereReconciliacion,true);
 }
 const valido=resolverSaldoAsesor({saldoVerificado:true,liquidezMinor:850000});
 assert.equal(valido.confiabilidad,"VERIFICADO");
 assert.equal(valido.montoMinor,850000);
});
