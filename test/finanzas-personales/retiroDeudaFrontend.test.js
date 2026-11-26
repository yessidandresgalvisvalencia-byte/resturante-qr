"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),vm=require("node:vm"),fs=require("node:fs");
const src=fs.readFileSync(require.resolve("../../public/finanzas-personales.js"),"utf8");
const fragmento=src.slice(src.indexOf("const operacionesRetiroDeuda="),src.indexOf("window.corregirPrestamo="));
function entorno(api,op={}){const avisos=[];let sec=0;const ctx={window:{},token:"sesion",$:()=>({hidden:false}),confirm:()=>true,alert:x=>avisos.push(x),api,body:x=>({method:"POST",body:JSON.stringify(x)}),load:async()=>{},crypto:{randomUUID:()=>"solicitud_"+(++sec)},retiroDeudaPersonal:null,...op};vm.runInNewContext(fragmento,ctx);return{ctx,w:ctx.window,avisos};}
test("retiro y recuperación canónicos delegan al diario durable con referencia exacta",async()=>{const llamadas=[],e=entorno(async()=>{throw Error("No usar flujo anterior");},{retiroDeudaPersonal:{operar:async(...a)=>llamadas.push(a)}});await e.w.retirarCredito("deuda");await e.w.restaurarDeudaRetirada("deuda","a".repeat(64));assert.equal(llamadas[0][0],"deuda");assert.equal(llamadas[0][1].restaurar,false);assert.equal(llamadas[1][1].restaurar,true);assert.equal(llamadas[1][1].retiroHash,"a".repeat(64));});
test("sin diario canónico no se envía ni se sustituye por memoria",async()=>{let llamadas=0;const e=entorno(async()=>llamadas++);await e.w.retirarCredito("deuda");assert.equal(llamadas,0);assert.match(e.avisos[0],/Diario.*no disponible/);});
test("crédito legacy conserva aislamiento ante sesión cambiada y respuesta obsoleta",async()=>{let resolver,cargas=0;const e=entorno(async()=>new Promise(r=>resolver=r),{load:async()=>cargas++});const t=e.w.retirarCredito("legacy",true);e.ctx.token="otra";resolver({resultado:{vigente:true}});await t;assert.equal(cargas,0);assert.equal(e.avisos.length,0);const obsoleto=entorno(async()=>({resultado:{vigente:false}}));await obsoleto.w.retirarCredito("legacy",true);assert.match(obsoleto.avisos[0],/estado vigente/);});

test("crédito anterior: recuperación e incorporación usan rutas propias y la misma solicitud al reintentar",async()=>{
 const llamadas=[];const e=entorno(async(p,o)=>{llamadas.push({p,o});if(llamadas.length===1)throw Error("red");return{resultado:{vigente:true}};});
 await e.w.incorporarCreditoAnterior("c1");await e.w.incorporarCreditoAnterior("c1");
 assert.equal(llamadas[0].p,"/creditos/c1/incorporar-a-deudas");assert.equal(llamadas[1].o.method,"POST");
 assert.equal(JSON.parse(llamadas[0].o.body).solicitudId,JSON.parse(llamadas[1].o.body).solicitudId);
 await e.w.restaurarCreditoAnterior("c2","a".repeat(64));assert.equal(llamadas[2].p,"/creditos/c2/restaurar-retiro");
 assert.equal(JSON.parse(llamadas[2].o.body).retiroHash,"a".repeat(64));
});
