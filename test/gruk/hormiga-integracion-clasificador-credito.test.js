"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {resumir}=require("../../modules/finanzas-personales/services/gastosHormigaResumen.service");
const ahora=new Date("2026-10-20T15:00:00Z");
function movimiento(id,concepto,montoMinor,medioPago="DEBITO",tipo="GASTO"){
 return {_id:id,fecha:new Date("2026-10-20T10:00:00Z"),tipo,estado:"ACTIVA",
  impactoCaja:medioPago!=="CREDITO",medioPago,montoMinor,concepto,categoria:"Otros"};
}
test("integración simultánea: excluir cafetera financiada sin omitir Rappi con tarjeta",()=>{
 const r=resumir([
  movimiento("1","Compré una cafetera",180000,"CREDITO"),
  movimiento("2","Pedido en Rappi",25000,"CREDITO"),
  movimiento("3","Café Juan Valdez",10000),
  movimiento("4","Pagué tarjeta Rappi",25000,"DEBITO","PAGO_DEUDA"),
  movimiento("5","En un día distinto",5000)
 ],ahora);
 assert.equal(r.semanaMinor,10000);
 assert.equal(r.creditoSemanaMinor,25000);
 assert.equal(r.consumoTotalSemanaMinor,35000);
 assert.equal(r.promedioDiarioConsumoMinor,5000);
 assert.equal(r.movimientosSemana,1);
 assert.equal(r.movimientosCreditoSemana,1);
});
test("integración simultánea: protección de arriendo y pagos de tarjeta sin doble descuento",()=>{
 const r=resumir([
  movimiento("1","Arriendo y café",700000,"DEBITO"),
  movimiento("2","Pago tarjeta de crédito Rappi",25000,"DEBITO"),
  movimiento("3","Mecato en OXXO",2000,"CREDITO")
 ],ahora);
 assert.equal(r.semanaMinor,0);
 assert.equal(r.creditoSemanaMinor,2000);
 assert.equal(r.consumoTotalSemanaMinor,2000);
});
