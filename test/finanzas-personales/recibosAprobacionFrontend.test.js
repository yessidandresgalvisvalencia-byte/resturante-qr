"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),vm=require("node:vm"),fs=require("node:fs"),crypto=require("node:crypto");
const {crearControlMutacionesPersonales:crear}=require("../../public/finanzas-personales-control-mutaciones");
const src=fs.readFileSync(require.resolve("../../public/finanzas-personales.js"),"utf8"),fragmento=src.slice(src.indexOf("const aprobacionesEnCurso="),src.indexOf("window.discardDraft="));
function entorno(api,control){const mensajes=[],dom=new Map();let n=0,cargas=0;const ctx={window:{},token:"sesion",$:id=>{if(!dom.has(id))dom.set(id,{hidden:false,disabled:false});return dom.get(id);},confirm:()=>true,versionesBorradores:new Map([["a".repeat(24),"c".repeat(64)]]),crypto:{randomUUID:()=>"prueba_"+(++n)},api,controlFinancieroPersonal:()=>control,msg:(...args)=>mensajes.push(args),loadDrafts:async()=>{},load:async()=>cargas++};vm.runInNewContext(fragmento,ctx);return{ctx,mensajes,cargas:()=>cargas};}
function control(){const datos=new Map();return crear({almacenamiento:{getItem:k=>datos.get(k)??null,setItem:(k,v)=>datos.set(k,v)},digerir:async v=>crypto.createHash("sha256").update(v).digest("hex"),usuarioDeToken:t=>t});}
test("aprobar exige confirmación, clave y bloqueo de doble clic",async()=>{
 let resolver,llamadas=[];const e=entorno(async(p,o)=>{llamadas.push({p,o});return await new Promise(r=>resolver=r);},control());
 const uno=e.ctx.window.approveDraft("a".repeat(24));await e.ctx.window.approveDraft("a".repeat(24));assert.equal(llamadas.length,1);assert.match(llamadas[0].o.headers["Idempotency-Key"],/^aprobacion_/);assert.equal(JSON.parse(llamadas[0].o.body).confirmacion,true);resolver({resultado:{estado:"APROBADO",recibo:{confirmado:true}}});await uno;assert.equal(e.cargas(),1);
 e.ctx.confirm=()=>false;await e.ctx.window.approveDraft("b".repeat(24));assert.equal(llamadas.length,1);
});
test("consulta recibo tras respuesta perdida resuelve solo la huella de aprobación, sin otro POST",async()=>{
 const c=control(),ruta="/captura/"+"a".repeat(24)+"/aprobar",id="aprobacion_prueba_01",op=await c.iniciar("sesion",ruta,{method:"POST",headers:{"Idempotency-Key":id},body:JSON.stringify({confirmacion:true,versionBorrador:"c".repeat(64)})});op.finalizar("INCIERTA");let llamadas=0;
 const e=entorno(async(p,o)=>{llamadas++;assert.equal(o,undefined);assert.equal(p,"/captura/confirmacion-aprobacion/"+id);return{recibo:{confirmado:true,versionBorrador:"c".repeat(64),hash:"a".repeat(64),solicitudId:id,ruta,metodo:"POST",certificaEstadoActual:false}};},c);
 await e.ctx.window.confirmarAprobacionesPendientes();assert.equal(llamadas,1);assert.equal(c.estado("sesion").bloqueada,false);assert.equal(e.cargas(),1);
});
test("recibo faltante, otra ruta o cambio de cuenta conservan incertidumbre",async()=>{
 const c=control(),ruta="/captura/"+"a".repeat(24)+"/aprobar",id="aprobacion_prueba_01",op=await c.iniciar("sesion",ruta,{method:"POST",headers:{"Idempotency-Key":id},body:JSON.stringify({confirmacion:true,versionBorrador:"c".repeat(64)})});op.finalizar("INCIERTA");
 let resolver;const e=entorno(async()=>await new Promise(r=>resolver=r),c),pendiente=e.ctx.window.confirmarAprobacionesPendientes();e.ctx.token="otra";resolver({recibo:{confirmado:true,versionBorrador:"c".repeat(64),hash:"a".repeat(64),solicitudId:id,ruta,metodo:"POST"}});await pendiente;assert.equal(c.estado("sesion").bloqueada,true);assert.equal(e.mensajes.length,0);
 assert.equal(await c.confirmarAprobacion("sesion",{confirmado:true,versionBorrador:"c".repeat(64),hash:"a".repeat(64),certificaEstadoActual:false,solicitudId:id,ruta:ruta.replace("a".repeat(24),"b".repeat(24)),metodo:"POST"}),false);assert.equal(c.estado("sesion").bloqueada,true);
});
