"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const src=fs.readFileSync(path.join(__dirname,"../../public/finanzas-personales.js"),"utf8");
test("Diagnóstico y error de carga secundaria respetan cambio de sesión",()=>{
 const start=src.indexOf("async function load()"),end=src.indexOf("}window.deshacerUltimaCuota",start);
 assert.ok(start>=0&&end>start);
 const load=src.slice(start,end);
 const guard='if(token!==tokenAlInicio||!tokenAlInicio||$("app").hidden)return;';
 const diagnostic=load.indexOf('const verificacion=await api("/diagnostico-integridad")');
 const guardIndex=load.indexOf(guard,diagnostic);
 const integrity=load.indexOf("const integridad=",diagnostic);
 assert.ok(diagnostic>=0&&guardIndex>diagnostic&&guardIndex<integrity);
 assert.match(load,/cargarCompromisosCuotas\(\)\.catch\(e=>\{if\(token!==tokenAlInicio\|\|!tokenAlInicio\|\|\$\("app"\)\.hidden\)return/);
});
