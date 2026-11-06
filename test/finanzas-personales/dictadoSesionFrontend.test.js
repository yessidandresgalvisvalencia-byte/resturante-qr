"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const src=fs.readFileSync(path.resolve(__dirname,"../../public/finanzas-personales.js"),"utf8");
function entorno(microfono){
 const elementos=new Map(),reconocimientos=[];let permisos=0,paradas=0;
 const $=id=>{if(!elementos.has(id))elementos.set(id,{hidden:false,value:"",textContent:"",dataset:{}});return elementos.get(id);};
 class Reconocimiento{
  constructor(){this.abortos=0;reconocimientos.push(this);}
  start(){this.iniciado=true;}
  abort(){this.abortos++;this.onend?.();}
 }
 const stream={getTracks:()=>[{stop:()=>paradas++}]};
 const ctx=vm.createContext({$,token:"sesion-uno",socket:null,window:{SpeechRecognition:Reconocimiento},
  navigator:{mediaDevices:{getUserMedia:()=>{permisos++;return microfono?microfono(stream):Promise.resolve(stream);}}},
  msg:(id,texto)=>{$(id).textContent=texto;},cancelarSolicitudes(){},limpiarIntentoManual(){},
  sessionStorage:{removeItem(){}},localStorage:{removeItem(){}}});
 const a=src.indexOf("const SR=window.SpeechRecognition"),b=src.indexOf(";if(token){enter",a);
 assert.ok(a>0&&b>a);vm.runInContext(src.slice(a,b+1),ctx);
 const c=src.indexOf("function clearToken(){"),d=src.indexOf("const $=",c);
 vm.runInContext(src.slice(c,d),ctx);
 return {$,ctx,reconocimientos,permisos:()=>permisos,paradas:()=>paradas};
}
const resultado=texto=>({results:[[{transcript:texto}]]});
test("dictado vigente agrega texto para revisión sin registrar movimientos",async()=>{
 const {$,reconocimientos}=entorno();$("captureText").value="Antes";
 await $("voice").onclick();reconocimientos[0].onresult(resultado("compré café"));
 assert.equal($("captureText").value,"Antes compré café");
 assert.match($("captureMsg").textContent,/Revisa el texto/);
});
test("transcripción y error de otra sesión no escriben en la cuenta actual",async()=>{
 const {$,ctx,reconocimientos}=entorno();await $("voice").onclick();
 ctx.token="sesion-dos";$("captureText").value="Datos actuales";$("captureMsg").textContent="Mensaje actual";
 reconocimientos[0].onresult(resultado("Texto de cuenta anterior"));
 reconocimientos[0].onerror({error:"network"});
 assert.equal($("captureText").value,"Datos actuales");assert.equal($("captureMsg").textContent,"Mensaje actual");
});
test("permiso tardío tras cambiar de sesión cierra las pistas y no inicia reconocimiento",async()=>{
 let resolver;const {$,ctx,reconocimientos,paradas}=entorno(stream=>new Promise(resolve=>{resolver=()=>resolve(stream);}));
 const pendiente=$("voice").onclick();ctx.token="sesion-dos";resolver();await pendiente;
 assert.equal(paradas(),1);assert.equal(reconocimientos.length,0);
});
test("dos clics mientras se solicita permiso solo abren una solicitud",async()=>{
 let resolver;const {$,permisos}=entorno(stream=>new Promise(resolve=>{resolver=()=>resolve(stream);}));
 const primero=$("voice").onclick(),segundo=$("voice").onclick();
 assert.equal(permisos(),1);resolver();await Promise.all([primero,segundo]);
});
test("cerrar sesión aborta el reconocimiento activo e invalida sus callbacks",async()=>{
 const {$,ctx,reconocimientos}=entorno();await $("voice").onclick();
 ctx.clearToken();assert.equal(reconocimientos[0].abortos,1);
 $("captureText").value="Cuenta siguiente";reconocimientos[0].onresult(resultado("Texto anterior"));
 assert.equal($("captureText").value,"Cuenta siguiente");
});
test("el cierre tardío de un reconocimiento no termina el nuevo dictado",async()=>{
 const {$,ctx,reconocimientos}=entorno();await $("voice").onclick();ctx.clearToken();
 ctx.token="sesion-dos";await $("voice").onclick();
 reconocimientos[0].onend();assert.equal($("voice").textContent,"🎙 Escuchando…");
 reconocimientos[1].onresult(resultado("Texto vigente"));assert.equal($("captureText").value,"Texto vigente");
});
test("cambiar de cuenta mediante enter aborta el dictado antes de aceptar la identidad nueva",async()=>{
 const {$,ctx,reconocimientos}=entorno();await $("voice").onclick();
 Object.assign(ctx,{storeToken(){},connect(){},load(){},invalidarIndicadoresFinancieros(){}});
 const a=src.indexOf("function enter(j)"),b=src.indexOf("function connect()",a);
 vm.runInContext(src.slice(a,b),ctx);ctx.enter({token:"sesion-dos"});
 assert.equal(reconocimientos[0].abortos,1);assert.equal(ctx.token,"sesion-dos");
 $("captureText").value="Nueva cuenta";reconocimientos[0].onresult(resultado("Audio anterior"));
 assert.equal($("captureText").value,"Nueva cuenta");
});
test("rechazo tardío del permiso tras cancelar no escribe errores en la sesión siguiente",async()=>{
 let rechazar;const {$,ctx}=entorno(()=>new Promise((_,reject)=>{rechazar=reject;}));
 const pendiente=$("voice").onclick();ctx.clearToken();ctx.token="sesion-dos";
 $("captureMsg").textContent="Mensaje de sesión actual";
 rechazar(Object.assign(Error("Permiso denegado"),{name:"NotAllowedError"}));await pendiente;
 assert.equal($("captureMsg").textContent,"Mensaje de sesión actual");
});
test("sin sesión o con el panel oculto no se solicita el micrófono",async()=>{
 const {$,ctx,permisos}=entorno();ctx.token=null;await $("voice").onclick();
 ctx.token="sesion-uno";$("app").hidden=true;await $("voice").onclick();
 assert.equal(permisos(),0);
});
