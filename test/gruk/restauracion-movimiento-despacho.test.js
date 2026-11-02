"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {crearRestauradorMovimiento}=require("../../modules/finanzas-personales/services/restauracionMovimientoPersonal.service");
const usuarioId="507f1f77bcf86cd799439011",movimientoId="507f1f77bcf86cd799439012",compromisoId="507f1f77bcf86cd799439013";
const datos={usuarioId,movimientoId,tipo:"RESTAURACION",idempotencyKey:"restaurar",anulacionHash:"a".repeat(64)};
function preparar(fuente){
 const llamadas=[];const ejecutar=crearRestauradorMovimiento({
  TransaccionModelo:{findOne(f){assert.equal(f.usuarioId,usuarioId);assert.equal(f._id,movimientoId);return{maxTimeMS(n){assert.equal(n,5000);return this;},lean:async()=>fuente};}},
  restaurarCuota:async(u,d)=>{llamadas.push({flujo:"cuota",u,d});return{compensacion:{hashActual:"recibo"}};},
  restaurarCaja:async d=>{llamadas.push({flujo:"caja",d});return{hashActual:"caja"};}
 });return{ejecutar,llamadas};
}
test("despacho de cuota usa solo identidad del pago original",async()=>{
 const e=preparar({tipo:"PAGO_DEUDA",descripcion:"Compromiso "+compromisoId+" cuota 2"});
 assert.equal((await e.ejecutar({...datos,compromisoId:"falso",numero:300})).hashActual,"recibo");
 assert.equal(e.llamadas[0].d.compromisoId,compromisoId);assert.equal(e.llamadas[0].d.numero,2);
 assert.equal(e.llamadas[0].u,usuarioId);
});
test("no convierte préstamos, fuentes ambiguas o cuotas inválidas en caja genérica",async()=>{
 for(const fuente of [{tipo:"PAGO_DEUDA",descripcion:"Cuota 1 confirmada",prestamoId:compromisoId},
  {tipo:"PAGO_DEUDA",descripcion:"Compromiso "+compromisoId+" cuota 999"},{tipo:"PAGO_DEUDA",descripcion:"sin vínculo"}]){
  const e=preparar(fuente);await assert.rejects(e.ejecutar(datos),x=>x.statusCode===409);assert.equal(e.llamadas.length,0);
 }
 const e=preparar(null);await assert.rejects(e.ejecutar(datos),x=>x.statusCode===404);
});
test("ingresos y gastos conservan flujo existente y se rechaza otra operación",async()=>{
 const e=preparar({tipo:"GASTO"});assert.equal((await e.ejecutar(datos)).hashActual,"caja");
 await assert.rejects(e.ejecutar({...datos,tipo:"ANULACION"}),x=>x.statusCode===400);
});
