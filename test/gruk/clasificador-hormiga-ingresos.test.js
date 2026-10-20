"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {clasificar}=require("../../modules/finanzas-personales/services/colombiaFinanciero.service");
test("ingreso recibido de comercios no se etiqueta como gasto hormiga",()=>{
 for(const texto of ["Ingreso por ventas Rappi","Propina Juan Valdez","Pago por domicilios Didi Food","Venta OXXO","Honorarios Pergamino"]){
  assert.equal(clasificar(texto,"INGRESO"),"Otros ingresos",texto);
 }
});
test("nomina y salario siguen clasificados como ingreso de salario",()=>{
 for(const texto of ["Mi salario","Nómina recibida","Quincena octubre","Prima de servicios"]){
  assert.equal(clasificar(texto,"INGRESO"),"Salario",texto);
 }
});
test("gastos hormiga y obligaciones esenciales no se mezclan",()=>{
 for(const texto of ["25 lucas en Rappi","Café Juan Valdez","Didi Food","Mecato en OXXO"]){
  assert.equal(clasificar(texto,"GASTO"),"Gastos hormiga",texto);
 }
 for(const texto of ["Arriendo apartamento","Cuota tarjeta","Pago de hipoteca","Internet de la casa"]){
  assert.notEqual(clasificar(texto,"GASTO"),"Gastos hormiga",texto);
 }
});
test("movimientos desconocidos no se convierten en ingresos por mencionar ventas",()=>{
 assert.equal(clasificar("Venta de un regalo","GASTO"),"Otros gastos");
 assert.equal(clasificar("Sin detalle","INGRESO"),"Otros ingresos");
});
