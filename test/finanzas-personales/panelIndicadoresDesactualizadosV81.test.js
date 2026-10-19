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

test("El panel rechaza indicadores ausentes antes de dibujar cifras financieras",()=>{
 const validacion=codigo.indexOf("const indicadoresObligatorios=");
 const render=codigo.indexOf('$("hComprometido").textContent=money(');
 assert.ok(validacion>0&&render>validacion,"validación monetaria debe anteceder renderizado");
 const fragmento=codigo.slice(validacion,render);
 for(const campo of ["r.resumen?.ingresos","r.resumen?.gastos","r.resumen?.deudaTotal",
  "home?.caja?.comprometidoMinor","home?.mes?.flujoRealizadoMinor","home?.patrimonio?.netoMinor"])
  assert.ok(fragmento.includes(campo),"indicador sin comprobación: "+campo);
 assert.match(fragmento,/indicadoresObligatorios\.every\(Number\.isSafeInteger\)/);
 assert.match(fragmento,/No se mostrarán como \$0/);
});
