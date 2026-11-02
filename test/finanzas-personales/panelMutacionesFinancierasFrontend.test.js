"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),vm=require("node:vm"),fs=require("node:fs"),crypto=require("node:crypto");
const {crearControlMutacionesPersonales}=require("../../public/finanzas-personales-control-mutaciones");
const src=fs.readFileSync(require.resolve("../../public/finanzas-personales.js"),"utf8"),defer=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const token=u=>"x."+Buffer.from(JSON.stringify({sub:u,scope:"finanzas:personal"})).toString("base64url")+".x";
const A="a".repeat(24),B="b".repeat(24);
const home=disponible=>({home:{caja:{comprometidoMinor:100,liquidezConciliada:true,disponibleDespuesCompromisosMinor:disponible},asesor:{aptoParaDisponibleHoy:true,disponibleHoyMinor:disponible},verdadFinanciera:{disponibleHoy:{montoMinor:disponible,requiereReconciliacion:false,confianza:"ALTA"}},mes:{flujoRealizadoMinor:900,ingresosMinor:1000,gastosConsumoMinor:100},patrimonio:{netoMinor:500},decisiones:[{prioridad:"BAJA",tipo:"CAJA",titulo:"Consejo anterior",detalle:"Dato observado"}]}});
const respuesta=j=>({ok:true,status:200,headers:{get:()=>"application/json"},json:async()=>j});
function entorno(controlFetch,storage=new Map()){
 const dom=new Map(),$=id=>{if(!dom.has(id)){let contenido="";dom.set(id,{get textContent(){return contenido;},set textContent(v){contenido=String(v);},get innerHTML(){return contenido;},set innerHTML(v){contenido=String(v);},insertAdjacentHTML(_p,v){contenido+=v;},hidden:false,dataset:{},style:{},querySelectorAll:()=>[],value:""});}return dom.get(id);};
 const fixture={"/diagnostico-integridad":{diagnostico:{identidadExistente:true,movimientos:1,deudas:1,cuentas:1}},"/resumen":{resumen:{ingresos:1000,gastos:100,deudaTotal:500}},"/diario?limit=500":{dias:[]},"/patrimonio":{patrimonio:{activosBase:1000,valorInversiones:0,deudas:500,patrimonioNeto:500}},"/prestamos":{prestamos:[]},"/creditos":{creditos:[]},"/notificaciones":{notificaciones:[]},"/gastos/hormiga/resumen":{},"/progreso-economico":{},"/home":home(200)};
 const ctx={token:token(A),window:{crearControlMutacionesPersonales},document:{getElementById:$},sessionStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},atob,crypto:crypto.webcrypto,TextEncoder,Uint8Array,AbortController,setTimeout,Intl,Date,Error,TypeError,JSON,Map,Set,esc:String,explicarBalancePersonal:()=>"Observación",cargarCompromisosCuotas:async()=>{},fetch:async(url,o)=>{const p=url.slice(4),override=await controlFetch?.(p,o);if(override!==undefined)return override;assert.ok(Object.hasOwn(fixture,p),p);return respuesta(fixture[p]);}};
 vm.createContext(ctx);vm.runInContext(src.slice(src.indexOf("const solicitudesEnCurso=new Set();"),src.indexOf("function body(")),ctx);
 vm.runInContext(src.slice(src.indexOf("function invalidarAutorizacionDisponible()"),src.indexOf("function invalidarIndicadoresFinancieros()")),ctx);
 vm.runInContext(src.slice(src.indexOf("let cargaPanelEnCurso=null;"),src.indexOf("}window.deshacerUltimaCuota=")+1),ctx);
 return{ctx,$,storage,fixture};
}
const patch=id=>({method:"PATCH",headers:{"Idempotency-Key":id},body:JSON.stringify({principalMinor:1200,confirmacion:true})});
test("commit con respuesta perdida no revive Disponible, recarga conserva incertidumbre y reintento usa clave original",async()=>{
 let enviado=0,recibidas=[];const vieja=defer(),homeSolicitado=defer();let primera=true;
 const f=entorno(async(p,o)=>{if(p==="/home"&&primera){primera=false;homeSolicitado.resolve();return await vieja.promise;}if(o.method==="PATCH"){recibidas.push(o.headers["Idempotency-Key"]);if(++enviado===1)throw Error("respuesta perdida tras commit");return respuesta({ok:true});}});
 const carga=f.ctx.load();await homeSolicitado.promise;await assert.rejects(f.ctx.api("/prestamos/p",patch("clave_original")),/respuesta perdida/);vieja.resolve(respuesta(home(999)));await carga;
 assert.equal(f.$("hDisponibleHoy").textContent,"No actualizado");f.fixture["/prestamos"]={prestamos:[{_id:"prestamo_propio",direccion:"POR_COBRAR",estado:"ACTIVO",contraparte:"Consulta propia",principalMinor:1000,saldoMinor:500}]};await f.ctx.load();assert.match(f.$("listaPorCobrar").innerHTML,/Consulta propia/);assert.equal(f.$("hDisponibleHoy").textContent,"No actualizado");assert.match(f.$("homeDecisions").textContent,/No hay una recomendación/);
 const recargado=entorno(async(p,o)=>{if(o.method==="PATCH"){recibidas.push(o.headers["Idempotency-Key"]);return respuesta({ok:true});}},f.storage);await recargado.ctx.load();assert.equal(recargado.$("hDisponibleHoy").textContent,"No actualizado");
 await recargado.ctx.api("/prestamos/p",patch("clave_nueva"));assert.deepEqual(recibidas,["clave_original","clave_original"]);recargado.fixture["/home"]=home(100);await recargado.ctx.load();assert.match(recargado.$("hDisponibleHoy").textContent,/100/);
});
test("carga pendiente no absorbe la actualización posterior a confirmar una operación",async()=>{
 const vieja=defer(),solicitado=defer();let primera=true;
 const f=entorno(async(p,o)=>{if(p==="/home"&&primera){primera=false;solicitado.resolve();return await vieja.promise;}if(o.method==="PATCH")return respuesta({ok:true});});
 const carga=f.ctx.load();await solicitado.promise;await f.ctx.api("/prestamos/p",patch("clave_original"));f.fixture["/home"]=home(100);await f.ctx.load();assert.match(f.$("hDisponibleHoy").textContent,/100/);vieja.resolve(respuesta(home(999)));await carga;assert.match(f.$("hDisponibleHoy").textContent,/100/);assert.doesNotMatch(f.$("hDisponibleHoy").textContent,/999/);
});
test("fallo tardío de otra cuenta no invalida disponible de la cuenta actual",async()=>{
 const pendiente=defer(),solicitado=defer();const f=entorno(async(_p,o)=>{if(o.method==="PATCH"){solicitado.resolve();return pendiente.promise;}});
 const escritura=f.ctx.api("/prestamos/p",patch("clave_original"));await solicitado.promise;f.ctx.token=token(B);await f.ctx.load();const actual=f.$("hDisponibleHoy").textContent;pendiente.reject(Error("red"));await assert.rejects(escritura,/sesión cambió/);assert.equal(f.$("hDisponibleHoy").textContent,actual);assert.equal(f.ctx.api.estadoFinanciero().bloqueada,false);
});
test("evaluación de compra iniciada antes de mutar no reaparece al terminar tarde",async()=>{
 const evaluacion=defer(),solicitada=defer();const f=entorno(async(p,o)=>{if(p==="/gastos/evaluar"){solicitada.resolve();return evaluacion.promise;}if(o.method==="PATCH")return respuesta({ok:true});});
 const a=src.indexOf('$("evaluarCompra").onclick=async()=>'),b=src.indexOf('$("refresh").onclick=',a);f.ctx.body=x=>({method:"POST",body:JSON.stringify(x)});vm.runInContext(src.slice(a,b),f.ctx);f.$("compraMonto").value="100";
 const consulta=f.$("evaluarCompra").onclick();await solicitada.promise;await f.ctx.api("/prestamos/p",patch("clave_original"));evaluacion.resolve(respuesta({ok:true,evaluacion:{estado:"CABE",mensaje:"Consejo anterior"}}));await consulta;assert.equal(f.$("compraRespuesta").hidden,true);assert.equal(f.$("compraRespuesta").textContent,"");assert.match(f.$("compraEstado").textContent,/No actualizado/);
});

test("HTTP 200 sin confirmación de aplicación permanece incierto y una consulta negativa no lo resuelve",async()=>{
 let confirma=false;const f=entorno(async(p,o)=>{if(p==="/transacciones")return respuesta({mensaje:"respuesta no verificable"});if(p==="/transacciones/confirmar-intento")return respuesta({ok:true,confirmado:confirma});});
 const payload={tipo:"GASTO",montoMinor:1200,externalId:"movimiento_01"};await assert.rejects(f.ctx.api("/transacciones",{method:"POST",body:JSON.stringify(payload)}),/no confirmó/);assert.equal(f.ctx.api.estadoFinanciero().bloqueada,true);
 await f.ctx.api("/transacciones/confirmar-intento",{method:"POST",body:JSON.stringify(payload)});assert.equal(f.ctx.api.estadoFinanciero().bloqueada,true);confirma=true;
 await f.ctx.api("/transacciones/confirmar-intento",{method:"POST",body:JSON.stringify({...payload,montoMinor:1300})});assert.equal(f.ctx.api.estadoFinanciero().bloqueada,true);
 await f.ctx.api("/transacciones/confirmar-intento",{method:"POST",body:JSON.stringify(payload)});assert.equal(f.ctx.api.estadoFinanciero().bloqueada,false);
});
