"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {validarFechaPagoVinculado,validarNoDuplicarOrigenHoy,ventanaPagoColombia,validarTotalPeriodoRecurrente}=require("../../modules/finanzas-personales/services/vinculoRecurrenteV81.service");

test("acepta pago actual y atrasado desde el origen exacto",()=>{
 const ahora=new Date("2026-10-18T16:00:00.000Z");
 const fechaOrigen=new Date("2024-01-18T05:00:00.000Z");
 for(const fechaPago of ["2026-10-18T15:59:59.999Z","2026-10-01T05:00:00Z","2024-01-18T05:00:00Z"]){
  assert.equal(validarFechaPagoVinculado({fechaPago,fechaOrigen,ahora}),true);
 }
});
test("rechaza pagos futuros, anteriores al origen y fechas inválidas",()=>{
 const ahora=new Date("2026-10-18T16:00:00.000Z");
 const fechaOrigen=new Date("2024-01-18T05:00:00.000Z");
 for(const fechaPago of ["2026-10-18T16:00:00.001Z","2026-10-19T05:00:00Z","2024-01-18T04:59:59Z","no-fecha"]){
  assert.throws(()=>validarFechaPagoVinculado({fechaPago,fechaOrigen,ahora}),{statusCode:400});
 }
 for(const datos of [
  {fechaPago:ahora,fechaOrigen:"no-fecha",ahora},
  {fechaPago:ahora,fechaOrigen,ahora:"no-fecha"}
 ])assert.throws(()=>validarFechaPagoVinculado(datos),{statusCode:400});
});

test("impide doble débito del origen recurrente en el mismo día colombiano",()=>{
 const origen=new Date("2026-10-18T05:00:00Z");
 for(const pago of ["2026-10-18T05:00:00Z","2026-10-19T04:59:59Z"])
  assert.throws(()=>validarNoDuplicarOrigenHoy({
   fechaPago:pago,fechaOrigen:origen,origenImpactoCaja:true
  }),{statusCode:409});
 assert.equal(validarNoDuplicarOrigenHoy({
  fechaPago:"2026-10-19T05:00:00Z",fechaOrigen:origen,origenImpactoCaja:true
 }),true);
 assert.equal(validarNoDuplicarOrigenHoy({
  fechaPago:"2026-10-18T12:00:00Z",fechaOrigen:origen,origenImpactoCaja:false
 }),true);
 assert.throws(()=>validarNoDuplicarOrigenHoy({
  fechaPago:"inválida",fechaOrigen:origen
 }),{statusCode:400});
});

test("ventana de abonos usa medianoche colombiana, incluso en cambio de mes",()=>{
 const a=ventanaPagoColombia("2026-10-19T04:59:59.999Z");
 assert.equal(a.inicio.toISOString(),"2026-10-18T05:00:00.000Z");
 assert.equal(a.fin.toISOString(),"2026-10-19T05:00:00.000Z");
 const b=ventanaPagoColombia("2026-11-01T04:59:59Z");
 assert.equal(b.inicio.toISOString(),"2026-10-31T05:00:00.000Z");
 assert.throws(()=>ventanaPagoColombia("invalida"),{statusCode:400});
});
test("abonos vinculados no pueden superar el importe previsto",()=>{
 assert.equal(validarTotalPeriodoRecurrente({
  importeObligacionMinor:550000,yaPagadoMinor:100000,nuevoPagoMinor:450000
 }),0);
 assert.equal(validarTotalPeriodoRecurrente({
  importeObligacionMinor:550000,yaPagadoMinor:100000,nuevoPagoMinor:200000
 }),250000);
 assert.throws(()=>validarTotalPeriodoRecurrente({
  importeObligacionMinor:550000,yaPagadoMinor:100000,nuevoPagoMinor:450001
 }),{statusCode:409});
 for(const bad of [1.5,-1,"500",Number.MAX_SAFE_INTEGER+1]){
  assert.throws(()=>validarTotalPeriodoRecurrente({
   importeObligacionMinor:550000,yaPagadoMinor:bad,nuevoPagoMinor:100000
  }),{statusCode:400});
 }
});
