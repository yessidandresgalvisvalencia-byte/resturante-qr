"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {crearEvento,verificarCadena,GENESIS}=require("../../modules/finanzas-personales/services/cadenaEventosV81.service");
const base={id:"event-1",userId:"user-1",tipo:"GASTO",montoCentavos:2500000n,fechaContable:"2026-10-17",timestamp:"2026-10-17T14:00:00-05:00",version:1};
test("cadena válida y hash genesis",()=>{
 const a=crearEvento(base);
 const b=crearEvento({...base,id:"event-2",version:2},a.hashActual);
 assert.equal(a.hashAnterior,GENESIS);
 assert.equal(verificarCadena([a,b]),true);
});
test("detecta manipulación de monto",()=>{
 const a=crearEvento(base);
 assert.equal(verificarCadena([{...a,montoCentavos:5000000n}]),false);
});
test("detecta eliminación intermedia cuando se conserva el siguiente evento",()=>{
 const a=crearEvento(base);
 const b=crearEvento({...base,id:"event-2",version:2},a.hashActual);
 assert.equal(verificarCadena([b]),false);
});
test("rechaza corrección sin motivo",()=>{
 assert.throws(()=>crearEvento({...base,tipo:"CORRECCION",corrigeId:"event-0"}),TypeError);
});
test("corrección es otro evento y el original permanece",()=>{
 const a=crearEvento(base);
 const b=crearEvento({...base,id:"event-2",tipo:"CORRECCION",montoCentavos:0n,corrigeId:a.id,motivo:"Valor corregido",version:2},a.hashActual);
 assert.equal(verificarCadena([a,b]),true);
 assert.equal(a.montoCentavos,2500000n);
});

test("rechaza cadena vacía: sin evidencia no hay integridad comprobada",()=>{
 assert.equal(verificarCadena([]),false);
});
test("registro malformado se trata como integridad fallida",()=>{
 const a=crearEvento(base);
 assert.equal(verificarCadena([{...a,montoCentavos:"2500000"}]),false);
 assert.equal(verificarCadena([null]),false);
});
