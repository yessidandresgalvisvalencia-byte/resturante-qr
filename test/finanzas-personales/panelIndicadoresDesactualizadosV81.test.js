"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const codigo=fs.readFileSync(path.join(__dirname,"../../public/finanzas-personales.js"),"utf8");
test("El panel invalida indicadores anteriores antes de consultar la red",()=>{
 assert.match(codigo,/function invalidarIndicadoresFinancieros\(\)/);
 assert.match(codigo,/const ejecucion=\(async\(\)=>\{invalidarIndicadoresFinancieros\(\);try\{/);
 for(const id of ["hDisponible","hComprometido","hFlujo","hPatrimonio"])assert.ok(codigo.includes('"'+id+'"'));
 assert.match(codigo,/el\.textContent="No actualizado"/);
});
