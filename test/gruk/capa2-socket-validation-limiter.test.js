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

test("Capa 2: 96 sockets, límite 64, rechazo inmediato y recuperación sin permisos cruzados",async()=>{
 const limite=crearLimiteValidaciones({maxConcurrent:64});
 let liberar;
 const consultaPendiente=new Promise(resolve=>liberar=resolve);
 let consultas=0;
 const crearSocket=(empresaId)=>{
  const s=new EventEmitter();
  s.connected=true;
  s.handshake={auth:{token:"token-"+empresaId}};
  s.auth={usuarioId:"usuario-"+empresaId,empresaId,sedeId:null,
   rol:"EMPLEADO",identityType:"USUARIO",tokenVersion:0};
  s.desconexiones=0;
  s.disconnect=function(){
   if(!this.connected)return;
   this.connected=false;
   this.desconexiones++;
   this.emit("disconnect");
  };
  return s;
 };
 const conexiones=Array.from({length:96},(_,i)=>{
  const s=crearSocket(i<64?"A":"B");
  let tick;
  const autenticar=async({signal})=>{
   consultas++;
   await consultaPendiente;
   return signal.aborted?null:s.auth;
  };
  const detener=vigilarSesionSocket(s,{
   secret:"ci-solo-prueba",intervalMs:5000,timeoutMs:1000,
   limite,autenticar,
   programar:fn=>{tick=fn;return 123;},cancelar:()=>{},
   programarTimeout:()=>({}),cancelarTimeout:()=>{}
  });
  return {s,tick,detener};
 });
 const activas=conexiones.slice(0,64).map(x=>x.tick());
 await Promise.resolve();
 assert.equal(limite.estadisticas().activas,64);
 assert.equal(consultas,64);
 const excedentes=conexiones.slice(64).map(x=>x.tick());
 await Promise.all(excedentes);
 assert.equal(conexiones.slice(64).every(x=>!x.s.connected&&x.s.desconexiones===1),true,
  "La empresa B no debe conservar sockets pendientes al saturar el límite");
 assert.equal(limite.estadisticas().rechazadas,32);
 assert.equal(limite.estadisticas().activas,64);
 liberar();
 await Promise.all(activas);
 assert.equal(limite.estadisticas().activas,0);
 assert.equal(conexiones.slice(0,64).every(x=>x.s.connected),true,
  "Las sesiones legítimas A pueden terminar la validación ya iniciada");
 // Revocación posterior: ninguna respuesta de una verificación antigua
 // puede conservar acceso después de invalidar el token.
 const revocar=conexiones.slice(0,64).map(x=>{
  x.detener();
  const actual=x.s.auth;
  const pendiente=comprobarRevocacion(x.s,{...actual,tokenVersion:1});
  return pendiente;
 });
 await Promise.all(revocar);
 assert.equal(conexiones.every(x=>!x.s.connected),true);
 assert.equal(limite.estadisticas().activas,0);
 const recuperado=crearSocket("B");
 let tickNuevo;
 const detenerNuevo=vigilarSesionSocket(recuperado,{
  secret:"ci-solo-prueba",intervalMs:5000,limite,
  autenticar:async()=>recuperado.auth,
  programar:fn=>{tickNuevo=fn;return 124;},cancelar:()=>{}
 });
 await tickNuevo();
 assert.equal(recuperado.connected,true);
 assert.equal(limite.estadisticas().rechazadas,32);
 assert.equal(limite.estadisticas().activas,0);
 detenerNuevo();
});
async function comprobarRevocacion(s,alterada){
 const {comprobarSocketVigente}=require("../../core/auth/socketSessionWatchdog.service");
 return comprobarSocketVigente(s,{secret:"ci-solo-prueba",
  autenticar:async()=>alterada});
}
