"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),vm=require("node:vm"),fs=require("node:fs");
const src=fs.readFileSync(require.resolve("../../public/finanzas-personales.js"),"utf8"),fragmento=src.slice(src.indexOf("const correccionesPrestamoPendientes="),src.indexOf("window.corregirOrigenCobro="));
function entorno(api){let n=0;const avisos=[],ctx={window:{},token:"sesion",$:()=>({hidden:false}),crypto:{randomUUID:()=>"solicitud_"+(++n)},api,alert:m=>avisos.push(m),money:String};vm.runInNewContext(fragmento,ctx);return{ctx,avisos};}
test("reintento conserva clave y consentimiento sin convertir importes",async()=>{
 const llamadas=[],e=entorno(async(p,o)=>{llamadas.push(o);if(llamadas.length===1)throw Error("red");return{prestamo:{correccion:{vigente:true}}};});
 await assert.rejects(e.ctx.aplicarCorreccionPrestamo("p",{principalMinor:1200}),/red/);await e.ctx.aplicarCorreccionPrestamo("p",{principalMinor:1200});assert.equal(llamadas[0].headers["Idempotency-Key"],llamadas[1].headers["Idempotency-Key"]);assert.equal(JSON.parse(llamadas[1].body).principalMinor,1200);assert.equal(JSON.parse(llamadas[1].body).confirmacion,true);
});
test("bloquea doble envío y descarta confirmación de otra sesión",async()=>{
 let resolver,llamadas=0;const e=entorno(async()=>{llamadas++;return await new Promise(r=>resolver=r);});const pendiente=e.ctx.aplicarCorreccionPrestamo("p",{concepto:"Otro"});await assert.rejects(e.ctx.aplicarCorreccionPrestamo("p",{concepto:"Otro"}),/en curso/);assert.equal(llamadas,1);e.ctx.token="otra";resolver({prestamo:{correccion:{vigente:true}}});await assert.rejects(pendiente,x=>x.code==="SESION_CAMBIADA");
});
test("recibo obsoleto no confirma éxito y consulta tardía de historia no se muestra",async()=>{
 const e=entorno(async()=>({prestamo:{correccion:{vigente:false}}}));await assert.rejects(e.ctx.aplicarCorreccionPrestamo("p",{concepto:"Otro"}),/estado vigente/);
 let resolver;e.ctx.api=async()=>await new Promise(r=>resolver=r);const pendiente=e.ctx.window.verCorreccionesPrestamo("p");e.ctx.token="otra";resolver({eventos:[]});await pendiente;assert.equal(e.avisos.length,0);
});
