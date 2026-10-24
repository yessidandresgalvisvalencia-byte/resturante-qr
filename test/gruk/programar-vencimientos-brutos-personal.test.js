"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {programarVencimientosBrutos}=require(
 "../../modules/finanzas-personales/services/programarVencimientosBrutosPersonal.service");
const origen=(fecha,frecuencia)=>({fecha,montoMinor:500000,recurrente:true,frecuencia});
function fechas(input){return programarVencimientosBrutos(input).map(x=>x.fecha.toISOString());}
test("arriendo día 31 se ajusta a febrero y vuelve a 31 en marzo",()=>{
 const d=fechas({origen:origen("2027-01-31T17:00:00-05:00","MENSUAL"),
  desde:"2027-02-01T05:00:00Z",hasta:"2027-04-01T05:00:00Z"});
 assert.deepEqual(d,["2027-02-28T22:00:00.000Z","2027-03-31T22:00:00.000Z"]);
});
test("año bisiesto conserva 29 de febrero cuando corresponde",()=>{
 const d=fechas({origen:origen("2024-02-29T07:00:00-05:00","ANUAL"),
  desde:"2027-01-01T05:00:00Z",hasta:"2029-01-01T05:00:00Z"});
 assert.deepEqual(d,["2027-02-28T12:00:00.000Z","2028-02-29T12:00:00.000Z"]);
});
test("frecuencias diaria, semanal y quincenal avanzan sin dobles cobros",()=>{
 for(const [frecuencia,cantidad] of [["DIARIA",5],["SEMANAL",1],["QUINCENAL",1]]){
  const d=fechas({origen:origen("2026-11-01T08:00:00-05:00",frecuencia),
   desde:"2026-11-01T05:00:00Z",hasta:"2026-11-06T05:00:00Z"});
  assert.equal(d.length,cantidad);
  assert.equal(new Set(d).size,cantidad);
 }
});
test("cancelación suprime vencimientos, no genera movimientos de caja",()=>{
 const d=programarVencimientosBrutos({origen:origen("2026-11-15T07:00:00-05:00","MENSUAL"),
  desde:"2026-11-01T05:00:00Z",hasta:"2027-01-01T05:00:00Z",
  cancelada:true});
 assert.deepEqual(d,[]);
});
test("no recurrente conserva fecha exacta, sin repeticiones",()=>{
 const o={fecha:"2026-11-15T07:00:00-05:00",montoMinor:500000,
  recurrente:false,frecuencia:"NINGUNA"};
 const d=fechas({origen:o,desde:"2026-11-01T05:00:00Z",
  hasta:"2027-01-01T05:00:00Z"});
 assert.deepEqual(d,["2026-11-15T12:00:00.000Z"]);
});
test("no extrapola fuera del máximo de 366 días ni acepta fechas imposibles",()=>{
 for(const escenario of [
  {origen:origen("2026-11-01T12:00:00Z","MENSUAL"),
   desde:"2026-01-01T05:00:00Z",hasta:"2028-01-01T05:00:00Z"},
  {origen:origen("errónea","MENSUAL"),
   desde:"2026-11-01T05:00:00Z",hasta:"2026-12-01T05:00:00Z"},
  {origen:origen("2026-11-01T12:00:00Z","NINGUNA"),
   desde:"2026-11-01T05:00:00Z",hasta:"2026-12-01T05:00:00Z"}
 ])assert.throws(()=>programarVencimientosBrutos(escenario),
  e=>e.statusCode===400);
});
