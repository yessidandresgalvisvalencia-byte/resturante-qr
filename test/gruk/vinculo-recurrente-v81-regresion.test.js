"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {
 validarFechaPagoVinculado,
 validarNoDuplicarOrigenHoy,
 ventanaPagoColombia,
 periodoRecurrenteColombia,
 validarTotalPeriodoRecurrente,
} = require("../../modules/finanzas-personales/services/vinculoRecurrenteV81.service");

test("rechaza pago anterior al origen, futuro o con fecha inválida", () => {
 const origen = "2026-10-01T12:00:00Z";
 assert.throws(() => validarFechaPagoVinculado({fechaOrigen: origen, fechaPago:"2026-09-30T12:00:00Z", ahora:"2026-10-18T12:00:00Z"}), /anterior/);
 assert.throws(() => validarFechaPagoVinculado({fechaOrigen: origen, fechaPago:"2026-10-19T12:00:00Z", ahora:"2026-10-18T12:00:00Z"}), /futuro/);
 assert.throws(() => validarFechaPagoVinculado({fechaOrigen:"fecha mala",fechaPago:origen}), /fecha ISO/);
});
test("impide contabilizar dos veces en el mismo día de Bogotá", () => {
 assert.throws(() => validarNoDuplicarOrigenHoy({
   fechaOrigen:"2026-10-18T05:30:00Z",fechaPago:"2026-10-18T23:00:00Z",
 }), error => error.statusCode === 409);
 assert.equal(validarNoDuplicarOrigenHoy({
   fechaOrigen:"2026-10-18T05:30:00Z",fechaPago:"2026-10-18T23:00:00Z",origenImpactoCaja:false,
 }), true);
});
test("ventana colombiana empieza a las 05:00 UTC y termina 24 horas después", () => {
 const {inicio,fin}=ventanaPagoColombia("2026-10-18T04:59:59Z");
 assert.equal(inicio.toISOString(),"2026-10-17T05:00:00.000Z");
 assert.equal(fin.toISOString(),"2026-10-18T05:00:00.000Z");
});
test("mensual con día 31 ancla vencimiento al último día del mes", () => {
 const p=periodoRecurrenteColombia({
   fechaOrigen:"2026-01-31T17:00:00Z",fechaPago:"2026-02-28T17:00:00Z",frecuencia:"MENSUAL",
 });
 assert.equal(p.inicio.toISOString(),"2026-02-28T05:00:00.000Z");
 assert.equal(p.fin.toISOString(),"2026-03-31T05:00:00.000Z");
});
test("un abono parcial no permite exceder la cuota del período", () => {
 assert.equal(validarTotalPeriodoRecurrente({importeObligacionMinor:100000,yaPagadoMinor:40000,nuevoPagoMinor:60000}),0);
 assert.throws(()=>validarTotalPeriodoRecurrente({importeObligacionMinor:100000,yaPagadoMinor:40000,nuevoPagoMinor:60001}),error=>error.statusCode===409);
 assert.throws(()=>validarTotalPeriodoRecurrente({importeObligacionMinor:100000,yaPagadoMinor:40000,nuevoPagoMinor:0}),error=>error.statusCode===409);
 assert.throws(()=>validarTotalPeriodoRecurrente({importeObligacionMinor:100000,yaPagadoMinor:0.1,nuevoPagoMinor:100}),error=>error.statusCode===400);
});

test("acepta fechas ISO reales con Z y desplazamiento horario", () => {
 assert.equal(validarFechaPagoVinculado({
  fechaOrigen:"2026-10-01T12:00:00Z",
  fechaPago:"2026-10-18T08:00:00-05:00",
  ahora:"2026-10-18T14:00:00Z",
 }),true);
 assert.throws(()=>validarFechaPagoVinculado({
  fechaOrigen:"2026-10-01T12:00:00Z",fechaPago:"18/10/2026",ahora:"2026-10-18T14:00:00Z",
 }),error=>error.statusCode===400);
});

test("rechaza fechas civiles imposibles antes de asignar cuotas o afectar caja",()=>{
 const origen="2026-02-01T12:00:00Z";
 const ahora="2026-10-18T12:00:00Z";
 for(const imposible of [
  "2026-02-30",
  "2026-02-30T12:00:00Z",
  "2025-02-29T12:00:00-05:00",
  "2026-04-31T08:00:00Z",
  "2026-13-01",
  "2026-00-15"
 ]){
  assert.throws(()=>validarFechaPagoVinculado({fechaOrigen:origen,fechaPago:imposible,ahora}),
   e=>e.statusCode===400,imposible);
  assert.throws(()=>periodoRecurrenteColombia({fechaOrigen:origen,fechaPago:imposible,frecuencia:"MENSUAL"}),
   e=>e.statusCode===400,imposible);
 }
 assert.equal(validarFechaPagoVinculado({
  fechaOrigen:"2024-02-29T12:00:00Z",fechaPago:"2024-03-01T12:00:00Z",ahora
 }),true);
});

test("rechaza husos horarios fuera del máximo UTC 14 y conserva zona colombiana",()=>{
 const origen="2026-10-01T12:00:00Z",ahora="2026-10-18T18:00:00Z";
 for(const fechaPago of [
  "2026-10-18T08:00:00+14:01",
  "2026-10-18T08:00:00-14:30",
  "2026-10-18T08:00:00+15:00",
  "2026-10-18T08:00:00-23:59"
 ]){
  assert.throws(()=>validarFechaPagoVinculado({fechaOrigen:origen,fechaPago,ahora}),
   e=>e.statusCode===400,fechaPago);
 }
 assert.equal(validarFechaPagoVinculado({
  fechaOrigen:origen,fechaPago:"2026-10-18T08:00:00-05:00",ahora
 }),true);
});
