"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const codigo=fs.readFileSync(path.join(__dirname,"../../public/finanzas-personales.js"),"utf8");
test("El panel conserva lectura de la misma cuenta y la invalida al cambiar de sesión",()=>{
 assert.match(codigo,/function invalidarIndicadoresFinancieros\(\)/);
 assert.match(codigo,/const ejecucion=\(async\(\)=>\{const liveAlCargar=/);
 assert.doesNotMatch(codigo,/const ejecucion=\(async\(\)=>\{invalidarIndicadoresFinancieros\(\);try\{/);
 assert.match(codigo,/if\(token!==j\.token\)\{cancelarSolicitudes\(\);limpiarIntentoManual\(\);invalidarIndicadoresFinancieros\(\)/);
 const invalidacion=codigo.slice(codigo.indexOf("function invalidarIndicadoresFinancieros()"),codigo.indexOf("let cargaPanelEnCurso="));
 for(const id of ["hDisponibleHoy","hDisponible","hComprometido","hFlujo","hPatrimonio","rIngresos","rGastos","rFlujo","rDeuda","pActivos","pInversiones","pDeudas","pNeto"])assert.ok(invalidacion.includes('"'+id+'"'),"No debe quedar en $0 el indicador "+id);
 for(const id of ["diario","listaPorCobrar","listaPorPagar","listaPrestamosPagados","homeDecisions","compromisosActivos","compromisosArchivados","flujoConciliacion"])assert.ok(invalidacion.includes('"'+id+'"'),"No debe mostrar datos de la sesión anterior: "+id);
 assert.match(codigo,/el\.textContent="No actualizado"/);
 assert.match(codigo,/catch\(e\)\{if\(e\.code==="SESION_CAMBIADA"[\s\S]*?const live=\$\("live"\)/);
 assert.match(codigo,/Las cifras visibles pueden corresponder a una consulta anterior/);
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

test("El formateador de COP nunca inventa $0, no redondea ni pierde precisión",()=>{
 const vm=require("node:vm");
 const inicio=codigo.indexOf("money=n=>{");
 const fin=codigo.indexOf(";async function api",inicio);
 assert.ok(inicio>0&&fin>inicio,"formateador personal presente");
 const money=vm.runInNewContext("("+codigo.slice(inicio,fin)+")",{Intl,Number,NaN});
 assert.match(money(0),/0/);
 assert.match(money(120000),/120/);
 assert.match(money(-5000),/5/);
 for(const valor of [undefined,null,"",false,0.1,1.25,Number.MAX_SAFE_INTEGER+1,"1.5","1e3","NaN",{},Infinity])
  assert.equal(money(valor),"No actualizado",String(valor)+" nunca puede convertirse a pesos");
 assert.match(money("120000"),/120/);
});

test("Cambio de sesión también invalida semáforo, balance y explicación anterior",()=>{
 const inicio=codigo.indexOf("function invalidarIndicadoresFinancieros()");
 const fin=codigo.indexOf("let cargaPanelEnCurso=",inicio);
 const bloque=codigo.slice(inicio,fin);
 for(const id of ["healthPercent","healthLabel","healthArrow","healthBubble","metricExplanation"])
  assert.ok(bloque.includes('$("'+id+'")'),"Debe limpiarse "+id);
 assert.match(bloque,/burbuja\.className="healthBubble neutral"/);
 assert.match(bloque,/Sin datos confirmados/);
 assert.match(codigo,/function clearToken\(\)[\s\S]*?invalidarIndicadoresFinancieros\(\)/);
});
