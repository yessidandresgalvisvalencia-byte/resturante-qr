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

test("la clasificación llega al resumen monetario sin inventar microgastos",()=>{
 const {resumir}=require("../../modules/finanzas-personales/services/gastosHormigaResumen.service");
 const ahora=new Date("2026-10-20T15:00:00Z");
 const crear=(id,concepto,montoMinor)=>({
  _id:id,fecha:new Date("2026-10-20T10:00:00Z"),tipo:"GASTO",
  estado:"ACTIVA",impactoCaja:true,medioPago:"DEBITO",
  concepto,categoria:"Hogar",montoMinor
 });
 const resultado=resumir([
  crear("a","Compré cafetera",180000),
  crear("b","Mecato en Rappi",25000),
  crear("c","Dije que el día era distinto",90000)
 ],ahora);
 assert.equal(resultado.semanaMinor,25000);
 assert.equal(resultado.mesMinor,25000);
 assert.equal(resultado.movimientosSemana,1);
 assert.equal(resultado.movimientosMes,1);
});
test("no permite que los pagos de vivienda y deudas inflen las alertas por comercio",()=>{
 const {resumir}=require("../../modules/finanzas-personales/services/gastosHormigaResumen.service");
 const ahora=new Date("2026-10-20T15:00:00Z");
 const tx=["Arriendo cafetería Juan Valdez","Pago de tarjeta Rappi","Compra de café en OXXO"].map((concepto,i)=>({
  _id:String(i+1),fecha:new Date("2026-10-20T10:00:00Z"),tipo:"GASTO",estado:"ACTIVA",
  impactoCaja:true,medioPago:"DEBITO",concepto,categoria:"Otros",montoMinor:10000
 }));
 const resultado=resumir(tx,ahora);
 assert.equal(resultado.semanaMinor,10000);
 assert.equal(resultado.movimientosSemana,1);
});
