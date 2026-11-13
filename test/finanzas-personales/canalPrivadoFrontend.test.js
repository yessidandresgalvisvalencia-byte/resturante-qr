"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const code=fs.readFileSync(require("node:path").resolve(__dirname,"../../public/finanzas-personales.js"),"utf8");
function entorno(){
 const nodos=new Map(),sockets=[];let cargas=0;
 const $=id=>{if(!nodos.has(id))nodos.set(id,{hidden:false,textContent:"",dataset:{}});return nodos.get(id);};
 const ctx=vm.createContext({token:"sesion-uno",socket:null,$,load(){cargas++;},io(){const eventos={},s={eventos,on(n,f){eventos[n]=f;return s;},disconnect(){eventos.disconnect?.("io client disconnect");}};sockets.push(s);return s;}});
 const a=code.indexOf("function connect(){"),b=code.indexOf("async function cargarCompromisosCuotas()",a);assert.ok(a>=0&&b>a);vm.runInContext(code.slice(a,b),ctx);
 return{ctx,$,sockets,cargas:()=>cargas,conectar(){vm.runInContext("connect()",ctx);return sockets.at(-1);}};
}
test("canal cerrado por servidor deja de anunciar conexión sin borrar ni reenviar solicitudes",()=>{
 const e=entorno(),s=e.conectar();s.eventos.connect();assert.match(e.$("canalPrivadoEstado").textContent,/conectado/);s.eventos.disconnect("io server disconnect");assert.match(e.$("canalPrivadoEstado").textContent,/desconectado/);assert.equal(e.$("canalPrivadoEstado").dataset.alert,"true");assert.equal(e.ctx.token,"sesion-uno");assert.equal(e.cargas(),0);
});
test("fallo de red y rechazo no exponen detalles, y reconexión actualiza solo estado del canal",()=>{
 const e=entorno(),s=e.conectar();s.eventos.connect_error(Error("JWT-privado"));assert.match(e.$("canalPrivadoEstado").textContent,/no disponible/);assert.ok(!e.$("canalPrivadoEstado").textContent.includes("JWT-privado"));s.eventos.connect();assert.equal(e.$("canalPrivadoEstado").dataset.alert,"false");s.eventos.disconnect("transport close");assert.match(e.$("canalPrivadoEstado").textContent,/desconectado/);s.eventos.connect();assert.match(e.$("canalPrivadoEstado").textContent,/conectado/);assert.equal(e.cargas(),0);
});
test("callbacks tardíos de otra conexión, token o pantalla no alteran el estado vigente",()=>{
 const e=entorno(),viejo=e.conectar(),nuevo=e.conectar();nuevo.eventos.connect();const texto=e.$("canalPrivadoEstado").textContent;viejo.eventos.disconnect();viejo.eventos.connect_error();assert.equal(e.$("canalPrivadoEstado").textContent,texto);e.ctx.token="sesion-dos";nuevo.eventos.disconnect();assert.equal(e.$("canalPrivadoEstado").textContent,texto);e.ctx.token="sesion-uno";e.$("app").hidden=true;nuevo.eventos.disconnect();assert.equal(e.$("canalPrivadoEstado").textContent,texto);
});
