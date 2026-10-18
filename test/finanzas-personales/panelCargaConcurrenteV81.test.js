"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"../../public/finanzas-personales.js"),"utf8");
test("Panel V81 conserva una sola carga concurrente y libera bloqueo tras resolver",()=>{
 const begin=source.indexOf("let cargaPanelEnCurso=null;");
 const end=source.indexOf("}window.deshacerUltimaCuota",begin);
 assert.ok(begin>=0&&end>begin);
 const snippet=source.slice(begin,end);
 assert.match(snippet,/if\(cargaPanelEnCurso\)return cargaPanelEnCurso/);
 assert.match(snippet,/finally\{if\(cargaPanelEnCurso===ejecucion\)cargaPanelEnCurso=null/);
 assert.match(snippet,/const ejecucion=\(async\(\)=>\{invalidarIndicadoresFinancieros\(\);try\{/);
});
