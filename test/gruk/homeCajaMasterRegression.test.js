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

test("liquidez verificada exige anclas, saldos y fechas realmente válidos",()=>{
 const {evaluarIntegridadAnclasPersonales}=require("../../modules/finanzas-personales/services/patrimonioPersonal.service");
 const cuenta={_id:"507f1f77bcf86cd799439011",saldoMinor:500000,
  saldoAnclaMinor:400000,saldoAnclaEn:new Date("2026-10-01T12:00:00Z"),
  saldoVerificadoEn:new Date("2026-10-01T12:00:00Z"),requiereReconciliacion:false};
 const verificada=evaluarIntegridadAnclasPersonales([cuenta]);
 assert.equal(verificada.saldoVerificado,true);
 assert.equal(verificada.anclaCompleta,true);
 for(const parcial of [
  {...cuenta,saldoAnclaEn:null},
  {...cuenta,saldoAnclaEn:new Date("invalida")},
  {...cuenta,saldoAnclaMinor:0.1},
  {...cuenta,saldoVerificadoEn:null},
  {...cuenta,saldoVerificadoEn:new Date("invalida")},
  {...cuenta,saldoMinor:NaN},
  {...cuenta,saldoMinor:Number.MAX_SAFE_INTEGER+1},
  {...cuenta,requiereReconciliacion:true}
 ]){
  const estado=evaluarIntegridadAnclasPersonales([cuenta,parcial]);
  assert.equal(estado.saldoVerificado,false);
  const saldo=resolverSaldoAsesorParaPrueba(estado);
  assert.notEqual(saldo.confiabilidad,"VERIFICADO");
 }
 assert.equal(evaluarIntegridadAnclasPersonales([]).saldoVerificado,false);
});
function resolverSaldoAsesorParaPrueba(estado){
 const {resolverSaldoAsesor}=require("../../modules/finanzas-personales/services/homePersonal.service");
 return resolverSaldoAsesor({saldoVerificado:estado.saldoVerificado,
  liquidezMinor:500000,hayMovimientosLedger:false});
}

test("un movimiento huérfano con nombre coincidente nunca entra silenciosamente al saldo anclado",()=>{
 const {saldoCuentasDesdeAnclas}=require("../../modules/finanzas-personales/services/patrimonioPersonal.service");
 const cuenta={_id:"507f1f77bcf86cd799439011",nombre:"Nequi",
  saldoAnclaMinor:100000,saldoAnclaEn:new Date("2026-10-01T05:00:00Z")};
 const ingreso={cuentaId:cuenta._id,cuenta:"Nequi",fecha:new Date("2026-10-02T05:00:00Z"),
  tipo:"INGRESO",montoMinor:5000,impactoCaja:true};
 assert.equal(saldoCuentasDesdeAnclas([cuenta],[ingreso]),105000);
 const huerfano={...ingreso,cuentaId:null};
 assert.throws(()=>saldoCuentasDesdeAnclas([cuenta],[huerfano]),
  e=>e.statusCode===409&&/sin cuentaId/.test(e.message));
 assert.equal(saldoCuentasDesdeAnclas([cuenta],[{...huerfano,fecha:new Date("2026-09-30T05:00:00Z")}]),100000);
 assert.throws(()=>saldoCuentasDesdeAnclas([cuenta],[{...ingreso,cuentaId:"507f1f77bcf86cd799439012"}]),
  e=>e.statusCode===409&&/inactiva, inexistente/.test(e.message));
});
test("la suma de cuentas ancladas no admite desbordamientos de enteros seguros",()=>{
 const {saldoCuentasDesdeAnclas}=require("../../modules/finanzas-personales/services/patrimonioPersonal.service");
 const fecha=new Date("2026-10-01T05:00:00Z");
 const cuenta={_id:"507f1f77bcf86cd799439011",nombre:"Nequi",
  saldoAnclaMinor:Number.MAX_SAFE_INTEGER,saldoAnclaEn:fecha};
 assert.throws(()=>saldoCuentasDesdeAnclas([cuenta, {...cuenta,_id:"507f1f77bcf86cd799439012",saldoAnclaMinor:1}],[]),
  e=>e.statusCode===409);
});

test("un huérfano posterior a la primera ancla bloquea el saldo aunque cambie el nombre de cuenta",()=>{
 const {saldoCuentasDesdeAnclas}=require("../../modules/finanzas-personales/services/patrimonioPersonal.service");
 const cuentas=[
  {_id:"507f1f77bcf86cd799439011",nombre:"Nequi",
   saldoAnclaMinor:100000,saldoAnclaEn:new Date("2026-10-01T05:00:00Z")},
  {_id:"507f1f77bcf86cd799439012",nombre:"Banco",
   saldoAnclaMinor:250000,saldoAnclaEn:new Date("2026-10-10T05:00:00Z")}
 ];
 const huerfano={cuentaId:null,cuenta:"CUENTA DESCONOCIDA",
  fecha:new Date("2026-10-05T05:00:00Z"),tipo:"INGRESO",
  montoMinor:15000,impactoCaja:true};
 assert.throws(()=>saldoCuentasDesdeAnclas(cuentas,[huerfano]),
  e=>e.statusCode===409&&/sin cuentaId/.test(e.message));
 assert.equal(saldoCuentasDesdeAnclas(cuentas,[{
  ...huerfano,fecha:new Date("2026-09-30T05:00:00Z")
 }]),350000);
 assert.equal(saldoCuentasDesdeAnclas(cuentas,[{
  ...huerfano,cuentaId:cuentas[0]._id
 }]),365000);
});

test("cuentas inexistentes o inactivas bloquean saldos anclados en vez de desaparecer",()=>{
 const {saldoCuentasDesdeAnclas}=require("../../modules/finanzas-personales/services/patrimonioPersonal.service");
 const cuentas=[{_id:"507f1f77bcf86cd799439011",nombre:"Nequi",
  saldoAnclaMinor:100000,saldoAnclaEn:new Date("2026-10-01T05:00:00Z")}];
 const movimiento={tipo:"INGRESO",montoMinor:15000,impactoCaja:true,
  cuenta:"Cuenta cerrada",fecha:new Date("2026-10-02T05:00:00Z")};
 for(const cuentaId of ["507f1f77bcf86cd799439012","no-es-object-id"]){
  assert.throws(()=>saldoCuentasDesdeAnclas(cuentas,[{...movimiento,cuentaId}]),
   e=>e.statusCode===409&&/inactiva, inexistente/.test(e.message));
 }
 assert.equal(saldoCuentasDesdeAnclas(cuentas,[{...movimiento,
  cuentaId:cuentas[0]._id}]),115000);
 assert.equal(saldoCuentasDesdeAnclas(cuentas,[{...movimiento,
  cuentaId:"507f1f77bcf86cd799439012",fecha:new Date("2026-09-30T05:00:00Z")}]),100000);
});
