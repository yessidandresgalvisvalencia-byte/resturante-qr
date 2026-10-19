"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const code=fs.readFileSync(path.join(__dirname,"../../public/finanzas-personales.js"),"utf8");
test("historial, borradores y chat rechazan respuestas tardias de otra identidad",()=>{
 for(const [begin,end,endpoint] of [
  ["async function loadDrafts()","window.editMovement=", "/captura/pendientes"],
  ["async function cargarHistorialChat()",'$("captureText").addEventListener',"/copilot/historial"],
  ["async function buscarHistorial(reset=true)",'$("historicalSearch").addEventListener',"/historial/buscar"]
 ]){
  const a=code.indexOf(begin),b=code.indexOf(end,a);
  assert.ok(a>=0&&b>a,"funcion a comprobar: "+begin);
  const fn=code.slice(a,b);
  assert.match(fn,/const tokenConsulta=token/);
  assert.ok(fn.includes(endpoint),"endpoint esperado: "+endpoint);
  assert.match(fn,/if\(!tokenConsulta\|\|token!==tokenConsulta\|\|\$\("app"\)\.hidden\)return/);
  assert.match(fn,/catch\(e\)\{/);
  assert.match(fn,/token===tokenConsulta/,"los avisos de error no deben aparecer en cuenta distinta");
 }
});
