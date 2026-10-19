"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const codigo=fs.readFileSync(path.join(__dirname,"../../public/finanzas-personales.js"),"utf8");
test("El panel invalida indicadores anteriores antes de consultar la red",()=>{
 assert.match(codigo,/function invalidarIndicadoresFinancieros\(\)/);
 assert.match(codigo,/const ejecucion=\(async\(\)=>\{invalidarIndicadoresFinancieros\(\);try\{/);
 const invalidacion=codigo.slice(codigo.indexOf("function invalidarIndicadoresFinancieros()"),codigo.indexOf("let cargaPanelEnCurso="));
 for(const id of ["hDisponibleHoy","hDisponible","hComprometido","hFlujo","hPatrimonio","rIngresos","rGastos","rFlujo","rDeuda"])assert.ok(invalidacion.includes('"'+id+'"'),"No debe quedar en $0 el indicador "+id);
 for(const id of ["diario","listaPorCobrar","listaPorPagar","listaPrestamosPagados","homeDecisions","compromisosActivos","flujoConciliacion"])assert.ok(invalidacion.includes('"'+id+'"'),"No debe mostrar datos de la sesión anterior: "+id);
 assert.match(codigo,/el\.textContent="No actualizado"/);
 assert.match(codigo,/catch\(e\)\{if\(e\.code==="SESION_CAMBIADA"[\s\S]*?invalidarIndicadoresFinancieros\(\);const live=\$\("live"\)/);
 assert.match(codigo,/Los indicadores no representan saldos confirmados/);
});
