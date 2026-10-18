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
   fechaOrigen:"2026-10-18T04:30:00Z",fechaPago:"2026-10-18T23:00:00Z",
 }), error => error.statusCode === 409);
 assert.equal(validarNoDuplicarOrigenHoy({
   fechaOrigen:"2026-10-18T04:30:00Z",fechaPago:"2026-10-18T23:00:00Z",origenImpactoCaja:false,
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
