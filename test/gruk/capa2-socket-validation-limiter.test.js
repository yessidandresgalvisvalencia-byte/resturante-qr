"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {crearLimiteValidaciones}=require("../../core/auth/socketValidationLimiter.service");
const {EventEmitter}=require("node:events");
const {vigilarSesionSocket}=require("../../core/auth/socketSessionWatchdog.service");

test("Capa 2: 300 sockets concurrentes no exceden 12 verificaciones",async()=>{
 const limite=crearLimiteValidaciones({maxConcurrent:12});
 let liberar;
 const bloqueo=new Promise(resolve=>{liberar=resolve;});
 let verificaciones=0;
 const peticiones=Array.from({length:300},()=>limite.ejecutar(async()=>{
  verificaciones++;await bloqueo;return true;
 }));
 await Promise.resolve();
 assert.equal(verificaciones,12);
 assert.equal(limite.estadisticas().activas,12);
 assert.equal(limite.estadisticas().rechazadas,288);
 liberar();
 const resultados=await Promise.all(peticiones);
 assert.equal(resultados.filter(x=>x===true).length,12);
 assert.equal(resultados.filter(x=>x===null).length,288);
 assert.equal(limite.estadisticas().activas,0);
 assert.equal(limite.estadisticas().maxObservado,12);
});
test("Capa 2: libera capacidad tras fallo del verificador",async()=>{
 const limite=crearLimiteValidaciones({maxConcurrent:1});
 await assert.rejects(limite.ejecutar(async()=>{throw Error("DB caída");}));
 assert.equal(limite.estadisticas().activas,0);
 assert.equal(await limite.ejecutar(async()=>42),42);
});
test("Capa 2: socket se desconecta cuando no hay capacidad",async()=>{
 const limite=crearLimiteValidaciones({maxConcurrent:1});
 let liberar;
 const bloqueo=new Promise(resolve=>{liberar=resolve;});
 const ocupado=limite.ejecutar(async()=>bloqueo);
 const s=new EventEmitter();
 s.connected=true;s.handshake={auth:{token:"example"}};
 s.auth={usuarioId:"u",empresaId:"a",rol:"EMPLEADO",sedeId:null,identityType:"USUARIO",tokenVersion:0};
 s.disconnect=function(){this.connected=false;this.emit("disconnect");};
 let tick;
 vigilarSesionSocket(s,{
  secret:"only-test",intervalMs:5000,limite,
  autenticar:async()=>s.auth,
  programar:fn=>{tick=fn;return 1;},cancelar:()=>{}
 });
 await tick();
 assert.equal(s.connected,false);
 assert.equal(limite.estadisticas().rechazadas,1);
 liberar();
 await ocupado;
});
test("Capa 2: configuración inválida no crea límite",()=>{
 assert.throws(()=>crearLimiteValidaciones({maxConcurrent:0}),/Límite/);
 assert.throws(()=>crearLimiteValidaciones({maxConcurrent:999999}),/Límite/);
});
