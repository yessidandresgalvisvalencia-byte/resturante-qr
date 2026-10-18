"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {validarFechaPagoVinculado}=require("../../modules/finanzas-personales/services/vinculoRecurrenteV81.service");

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
