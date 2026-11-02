"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),vm=require("node:vm"),fs=require("node:fs");
const src=fs.readFileSync(require.resolve("../../public/finanzas-personales.js"),"utf8");
const fragmento=src.slice(src.indexOf("const operacionesRetiroDeuda="),src.indexOf("window.corregirPrestamo="));
function entorno(api,op={}){const avisos=[];let sec=0;const ctx={window:{},token:"sesion",$:()=>({hidden:false}),confirm:()=>true,alert:x=>avisos.push(x),api,body:x=>({method:"POST",body:JSON.stringify(x)}),load:async()=>{},crypto:{randomUUID:()=>"solicitud_"+(++sec)},...op};vm.runInNewContext(fragmento,ctx);return{ctx,w:ctx.window,avisos};}
test("retiro exige confirmación, usa DELETE y conserva la solicitud si se pierde la respuesta",async()=>{
 let llamadas=[];const e=entorno(async(p,o)=>{llamadas.push({p,o});if(llamadas.length===1)throw Error("red");return{resultado:{vigente:true}};});
 await e.w.retirarCredito("deuda");await e.w.retirarCredito("deuda");assert.equal(llamadas.length,2);
 assert.equal(llamadas[0].o.method,"DELETE");assert.equal(JSON.parse(llamadas[0].o.body).confirmacion,true);
 assert.equal(JSON.parse(llamadas[0].o.body).solicitudId,JSON.parse(llamadas[1].o.body).solicitudId);
 const cancelado=entorno(async()=>{throw Error("No enviar");},{confirm:()=>false});await cancelado.w.retirarCredito("deuda");assert.equal(cancelado.avisos.length,0);
});
test("recuperación usa POST con retiro exacto y descarta respuesta al cambiar sesión",async()=>{
 let resolver,llamadas=0,cargas=0;const e=entorno(async(p,o)=>{llamadas++;assert.equal(p,"/prestamos/deuda/restaurar-retiro");assert.equal(o.method,"POST");assert.equal(JSON.parse(o.body).retiroHash,"a".repeat(64));return await new Promise(r=>resolver=r);},{load:async()=>cargas++});
 const pendiente=e.w.restaurarDeudaRetirada("deuda","a".repeat(64));await e.w.restaurarDeudaRetirada("deuda","a".repeat(64));assert.equal(llamadas,1);
 e.ctx.token="otra";resolver({resultado:{vigente:true}});await pendiente;assert.equal(cargas,0);assert.equal(e.avisos.length,0);
});
test("un recibo obsoleto no confirma recuperación ni retira créditos legacy",async()=>{
 let cargas=0,llamadas=0;const e=entorno(async()=>{llamadas++;return{resultado:{vigente:false}};},{load:async()=>cargas++});
 await e.w.restaurarDeudaRetirada("deuda","a".repeat(64));assert.equal(cargas,0);assert.match(e.avisos[0],/estado vigente/);
 await e.w.retirarCredito("legacy",true);assert.equal(llamadas,1);
});
