"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),H=require("../../modules/finanzas-personales/services/homePersonal.service");
test("mes de Colombia",()=>{assert.equal(H._fechas.monthStart(new Date("2026-11-01T03:00:00Z")).toISOString(),"2026-10-01T05:00:00.000Z");assert.equal(H._fechas.monthStart(new Date("2026-11-01T05:00:00Z")).toISOString(),"2026-11-01T05:00:00.000Z");});
test("pagos vinculados a deuda",()=>{const a={saldoMinor:80,cuotaMinor:50},b={saldoMinor:100,cuotaMinor:50};assert.equal(H.saldoCuotaPendienteMinor(a,20),30);assert.equal(H.saldoCuotaPendienteMinor(b,0),50);assert.equal(H.saldoCuotaPendienteMinor(a,50),0);assert.throws(()=>H.saldoCuotaPendienteMinor(a,0.5));});
