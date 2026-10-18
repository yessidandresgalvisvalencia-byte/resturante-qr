"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const source=fs.readFileSync(path.join(__dirname,"../../public/finanzas-personales.js"),"utf8");
test("V81 descarta la respuesta financiera si cambió la sesión antes de renderizar",()=>{
 const begin=source.indexOf("async function load()");
 const end=source.indexOf("}window.deshacerUltimaCuota",begin);
 assert.ok(begin>=0&&end>begin);
 const load=source.slice(begin,end);
 assert.match(load,/const tokenAlInicio=token/);
 assert.match(load,/if\(token!==tokenAlInicio\|\|!tokenAlInicio\|\|\$\("app"\)\.hidden\)return/);
 assert.ok(load.indexOf("if(token!==tokenAlInicio")<load.indexOf("const home=h.home"),"Debe comprobarse identidad antes de renderizar datos");
});
