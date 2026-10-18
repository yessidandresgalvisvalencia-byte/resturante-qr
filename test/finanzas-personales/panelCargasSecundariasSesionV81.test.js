"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const code=fs.readFileSync(path.join(__dirname,"../../public/finanzas-personales.js"),"utf8");
test("Las respuestas secundarias no se renderizan después de cambiar sesión",()=>{
 const c=code.slice(code.indexOf("async function cargarCompromisosCuotas"),code.indexOf("window.pagarCuotaCompromiso"));
 assert.match(c,/const tokenConsulta=token/);
 assert.match(c,/if\(!tokenConsulta\|\|token!==tokenConsulta\|\|\$\("app"\)\.hidden\)return/);
 const p=code.slice(code.indexOf('api("/progreso-economico").then('),code.indexOf('api("/progreso-economico").then(')+270);
 assert.match(p,/token!==tokenAlInicio/);
});
