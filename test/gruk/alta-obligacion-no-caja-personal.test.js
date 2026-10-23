"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const {registrarTransaccion}=require(
 "../../modules/finanzas-personales/services/flujoCajaPersonal.service");
const uid="507f1f77bcf86cd799439011";
test("obligación futura sin pago jamás puede registrarse como gasto de caja",async()=>{
 await assert.rejects(
  registrarTransaccion(uid,{
   tipo:"GASTO",montoMinor:500000,concepto:"Arriendo próximo",
   categoria:"Vivienda",cuenta:"EFECTIVO",impactoCaja:false,
   recurrente:true,frecuencia:"MENSUAL",fecha:"2026-10-25T12:00:00Z"
  }),
  error=>error.statusCode===422&&/no se registrará como dinero pagado/.test(error.message)
 );
});
test("petición de ingreso sin impacto de caja tampoco se convierte en depósito",async()=>{
 await assert.rejects(
  registrarTransaccion(uid,{
   tipo:"INGRESO",montoMinor:100000,concepto:"Ingreso previsto",
   categoria:"Ingresos",impactoCaja:false,fecha:"2026-10-25T12:00:00Z"
  }),
  error=>error.statusCode===422
 );
});
test("la validación de impacto ocurre antes de abrir transacción o tocar Mongo",()=>{
 const src=fs.readFileSync(path.join(__dirname,
  "../../modules/finanzas-personales/services/flujoCajaPersonal.service.js"),"utf8");
 const start=src.indexOf("async function registrarTransaccion(usuarioId,input)");
 const end=src.indexOf("async function publicarEvento",start);
 const alta=src.slice(start,end);
 assert.ok(alta.includes("if(input?.impactoCaja===false)"));
 assert.ok(alta.indexOf("if(input?.impactoCaja===false)")<
  alta.indexOf("mongoose.startSession()"));
 assert.ok(alta.indexOf("if(input?.impactoCaja===false)")<
  alta.indexOf("Transaccion.create("));
});
