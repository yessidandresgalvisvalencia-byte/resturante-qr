"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {clasificar,contieneCompleto,HORMIGA}=require("../../modules/finanzas-personales/services/colombiaFinanciero.service");
test("detecta gastos hormiga de Colombia con palabras completas, tildes y signos",()=>{
 for(const concepto of ["Rappi: almuerzo","Pagué café en Juan Valdez","Mecato del OXXO.","Uber Eats - domicilio","Un cafecito y tinto","Pedido en Didi Food","Gaseosa"]){
  assert.equal(clasificar(concepto,"GASTO"),"Gastos hormiga",concepto);
 }
});
test("no interpreta partes de palabras como microconsumo",()=>{
 for(const concepto of ["Compré cafetera","El asunto es distinto","Renové la póliza", "Servicio de domiciliarios de una empresa", "Cafeteras para la casa"]){
  assert.notEqual(clasificar(concepto,"GASTO"),"Gastos hormiga",concepto);
 }
});
test("un ingreso de comercio nunca se presenta como gasto hormiga",()=>{
 for(const concepto of ["Me pagaron en Rappi","Propina Juan Valdez","Ventas de café en OXXO"]){
  assert.notEqual(clasificar(concepto,"INGRESO"),"Gastos hormiga",concepto);
 }
 assert.equal(clasificar("hice un rebusque","INGRESO"),"Salario");
});
test("mantiene prioridad de arriendo, créditos y obligaciones",()=>{
 assert.equal(clasificar("Arriendo más café","GASTO"),"Gastos fijos");
 assert.equal(clasificar("Pago tarjeta de crédito Rappi","GASTO"),"Deuda");
 assert.equal(contieneCompleto("Me tomé un cafecito",HORMIGA),true);
 assert.equal(contieneCompleto("Compré una cafetera",HORMIGA),false);
});
