"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {EventEmitter}=require("node:events");
const {comprobarSocketVigente,vigilarSesionSocket}=require("../../core/auth/socketSessionWatchdog.service");
function socket(){
 const s=new EventEmitter();
 s.connected=true;s.handshake={auth:{token:"valid-token"}};
 s.auth=Object.freeze({usuarioId:"u1",empresaId:"e1",sedeId:"s1",
  rol:"EMPLEADO",identityType:"USUARIO",tokenVersion:0});
 s.disconnected=0;
 s.disconnect=function(){this.disconnected++;this.connected=false;this.emit("disconnect");};
 return s;
}
test("Capa 2: watchdog mantiene socket autorizado y desconecta sesión revocada",async()=>{
 const s=socket();
 let cb,ticks=0,cancelled=0;
 const detener=vigilarSesionSocket(s,{
  secret:"local-test",intervalMs:5000,
  autenticar:async()=>++ticks===1?s.auth:null,
  programar:fn=>{cb=fn;return {unref(){}};},
  cancelar:()=>cancelled++
 });
 await cb();
 assert.equal(s.connected,true);
 await cb();
 assert.equal(s.connected,false);
 assert.equal(s.disconnected,1);
 assert.equal(cancelled,1);
 detener();
 assert.equal(cancelled,1);
});
test("Capa 2: watchdog rechaza rol o empresa modificados tras handshake",async()=>{
 for(const alteracion of [{empresaId:"e2"},{rol:"DUEÑO"},{tokenVersion:1},{sedeId:"s2"}]){
  const s=socket();
  assert.equal(await comprobarSocketVigente(s,{
   secret:"test",autenticar:async()=>({...s.auth,...alteracion})
  }),false);
  assert.equal(s.disconnected,1);
 }
});
test("Capa 2: watchdog falla cerrado ante error de base de datos y cancela timer",async()=>{
 const s=socket();
 let cb,cancelled=0;
 vigilarSesionSocket(s,{
  secret:"test",intervalMs:5000,autenticar:async()=>{throw Error("db unavailable");},
  programar:fn=>{cb=fn;return 1;},cancelar:()=>cancelled++
 });
 await cb();
 assert.equal(s.disconnected,1);
 assert.equal(cancelled,1);
});
test("Capa 2: watchdog no programa intervalos inseguros",()=>{
 assert.throws(()=>vigilarSesionSocket(socket(),{intervalMs:1}),/Intervalo inválido/);
});

test("Capa 2: timeout de Mongo pendiente desconecta y limpia verificación",async()=>{
 const s=socket();
 let intervalo,limite,limpios=0,cancelados=0;
 const verificar=new Promise(()=>{});
 vigilarSesionSocket(s,{
  secret:"test",intervalMs:5000,timeoutMs:500,
  autenticar:async()=>verificar,
  programar:fn=>{intervalo=fn;return 17;},
  cancelar:()=>cancelados++,
  programarTimeout:fn=>{limite=fn;return 19;},
  cancelarTimeout:()=>limpios++
 });
 const enCurso=intervalo();
 await Promise.resolve();
 limite();
 await enCurso;
 assert.equal(s.disconnected,1);
 assert.equal(s.connected,false);
 assert.equal(limpios,1);
 assert.equal(cancelados,1);
});
test("Capa 2: no apila verificaciones cuando una consulta está pendiente",async()=>{
 const s=socket();
 let intervalo,liberar,consultas=0;
 const enEspera=new Promise(resolve=>liberar=resolve);
 const detener=vigilarSesionSocket(s,{
  secret:"test",intervalMs:5000,
  autenticar:async()=>{consultas++;await enEspera;return s.auth;},
  programar:fn=>{intervalo=fn;return 9;},
  cancelar:()=>{}
 });
 const pendiente=intervalo();
 await intervalo();
 await intervalo();
 assert.equal(consultas,1);
 liberar();
 await pendiente;
 detener();
});
test("Capa 2: valida timeout máximo acotado al intervalo",()=>{
 assert.throws(()=>vigilarSesionSocket(socket(),{timeoutMs:99}),/Tiempo máximo/);
 assert.throws(()=>vigilarSesionSocket(socket(),{intervalMs:5000,timeoutMs:5000}),/Tiempo máximo/);
});

test("Capa 2: vencimiento aborta la consulta de autorización pendiente",async()=>{
 const s=socket();
 let intervalo,limiteTiempo,observada=false,abortos=0;
 vigilarSesionSocket(s,{
  secret:"test",intervalMs:5000,timeoutMs:500,
  autenticar:async({signal})=>{
   assert.ok(signal,"Debe propagarse AbortSignal");
   return new Promise(resolve=>{
    if(signal.aborted){abortos++;return resolve(null);}
    signal.addEventListener("abort",()=>{abortos++;resolve(null);},{once:true});
   });
  },
  programar:fn=>{intervalo=fn;return 1;},cancelar:()=>{},
  programarTimeout:fn=>{limiteTiempo=fn;return 2;},cancelarTimeout:()=>{}
 });
 const pendiente=intervalo();
 await Promise.resolve();
 await Promise.resolve();
 limiteTiempo();
 await pendiente;
 assert.equal(abortos,1,"El timeout debe abortar la operación, no solo la espera");
 assert.equal(s.connected,false);
});
