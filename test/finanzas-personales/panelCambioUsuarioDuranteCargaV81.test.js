"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const src=fs.readFileSync(path.join(__dirname,"../../public/finanzas-personales.js"),"utf8");
test("Una nueva sesión puede actualizar el panel sin esperar carga de usuario anterior",()=>{
 const a=src.indexOf("let cargaPanelEnCurso=null;");
 const b=src.indexOf("}window.deshacerUltimaCuota",a);
 assert.ok(a>=0&&b>a);
 const load=src.slice(a,b);
 assert.match(load,/if\(cargaPanelEnCurso&&tokenCargaPanel===token\)return cargaPanelEnCurso/);
 assert.match(load,/tokenCargaPanel=tokenAlInicio/);
 assert.match(load,/if\(cargaPanelEnCurso===ejecucion\)\{cargaPanelEnCurso=null;tokenCargaPanel=null/);
 assert.match(load,/if\(token!==tokenAlInicio\|\|!tokenAlInicio/);
});
