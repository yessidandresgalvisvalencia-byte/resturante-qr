"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),vm=require("node:vm"),fs=require("node:fs");
const codigo=fs.readFileSync(require.resolve("../../public/finanzas-personales.js"),"utf8");
const fragmento=codigo.slice(codigo.indexOf("const mutacionesMovimientoEnCurso="),codigo.indexOf("window.approveDraft="));
function entorno(api,prompts=[]){let claves=0;const avisos=[];const context={window:{},api,load:async()=>{},crypto:{randomUUID:()=>"clave_"+(++claves)},confirm:()=>true,prompt:()=>prompts.shift(),alert:x=>avisos.push(x),Set,Map,JSON,Number,encodeURIComponent};vm.runInNewContext(fragmento,context);return{window:context.window,avisos};}
test("reintento por error de red conserva la clave de anulación",async()=>{
 const llamadas=[];const e=entorno(async(path,op)=>{llamadas.push(op);if(llamadas.length===1)throw TypeError("red");});
 await e.window.deleteMovement("m1");await e.window.deleteMovement("m1");
 assert.equal(llamadas.length,2);assert.equal(llamadas[0].headers["Idempotency-Key"],llamadas[1].headers["Idempotency-Key"]);
});
test("doble clic no envía una segunda mutación mientras espera respuesta",async()=>{
 let resolver,llamadas=0;const e=entorno(async()=>{llamadas++;await new Promise(r=>{resolver=r;});});
 const primera=e.window.deleteMovement("m1");await e.window.deleteMovement("m1");
 assert.equal(llamadas,1);resolver();await primera;
});
test("edición no transforma decimales en otro importe",async()=>{
 let llamadas=0;const e=entorno(async()=>{llamadas++;},["GASTO","1.5"]);
 await e.window.editMovement("m1","GASTO",1000);assert.equal(llamadas,0);assert.equal(e.avisos.length,1);
});
