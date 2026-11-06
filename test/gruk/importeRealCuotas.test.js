"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const service=fs.readFileSync(require.resolve("../../modules/finanzas-personales/services/patrimonioPersonal.service"),"utf8");
const routes=fs.readFileSync(require.resolve("../../modules/finanzas-personales/routes"),"utf8");
test("cuota exige monto real entero seguro",()=>{
 assert.match(service,/Number\.isSafeInteger\(montoPagadoRealMinor\)/);
 assert.match(routes,/montoPagadoRealMinor:Joi\.number\(\)\.integer\(\)\.min\(1\)/);
});
test("anulación compensatoria restaura pago real y admite registros antiguos sin ese campo",()=>{
 const {originalDesdeFuente,eventoCompensatorio}=require("../../modules/finanzas-personales/services/eventoCompensatorioPersonal.service");
 for(const real of [450,null,undefined]){
  const fuente={_id:"507f1f77bcf86cd799439011",usuarioId:"507f1f77bcf86cd799439012",prestamoId:"507f1f77bcf86cd799439013",
   tipo:"PAGO_DEUDA",montoMinor:400,montoPagadoRealMinor:real,concepto:"Cuota",categoria:"Pago de capital de deuda",descripcion:"Cuota 1 confirmada",impactoCaja:true};
  const antes={...fuente};
  const evento=eventoCompensatorio({original:originalDesdeFuente(fuente),tipo:"ANULACION",idempotencyKey:"reverso",
   prevHash:"0".repeat(64),secuencia:1,fechaISO:"2026-10-26T15:00:00.000Z"});
  assert.equal(evento.deltaCajaMinor,String(real??400));
  assert.equal(evento.original.montoMinor,400);assert.equal(evento.version,4);
  assert.deepEqual(fuente,antes);
 }
});
test("capital nunca aumenta por pagar",()=>assert.match(service,/Math\.min\(montoBase,montoPagadoRealMinor\)/));
