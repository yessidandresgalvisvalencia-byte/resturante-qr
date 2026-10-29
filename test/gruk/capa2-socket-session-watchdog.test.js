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
