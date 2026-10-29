"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {crearVerificadorCompartido}=require("../../core/auth/socketSharedVerifier.service");
const perfil=Object.freeze({usuarioId:"a",empresaId:"A",sedeId:null,rol:"DUEÑO",identityType:"USUARIO",tokenVersion:0});
test("Capa 2: 100 sockets con el MISMO JWT ejecutan una sola verificación pendiente",async()=>{
 let llamadas=0,liberar;
 const pendiente=new Promise(resolve=>liberar=resolve);
 let tiempo=1000;
 const v=crearVerificadorCompartido({
  verificar:async()=>{llamadas++;await pendiente;return perfil;},
  ahora:()=>tiempo
 });
 const respuestas=Array.from({length:100},()=>v.autenticar({token:"token-A",secret:"secreto"}));
 await Promise.resolve();
 assert.equal(llamadas,1);
 assert.equal(v.estadisticas().compartidas,99);
 liberar();
 assert.equal((await Promise.all(respuestas)).every(x=>x===perfil),true);
 assert.equal((await v.autenticar({token:"token-A",secret:"secreto"})),perfil);
 assert.equal(v.estadisticas().aciertos,1);
 tiempo+=351;
 await v.autenticar({token:"token-A",secret:"secreto"});
 assert.equal(llamadas,2,"Una expiración de TTL obliga nueva consulta");
});
test("Capa 2: cache no cruza tokens, secretos ni empresas",async()=>{
 let llamadas=0;
 const v=crearVerificadorCompartido({
  verificar:async({token})=>{llamadas++;return {...perfil,empresaId:token==="token-B"?"B":"A"};}
 });
 const a=await v.autenticar({token:"token-A",secret:"uno"});
 const b=await v.autenticar({token:"token-B",secret:"uno"});
 const distintoSecreto=await v.autenticar({token:"token-A",secret:"dos"});
 assert.equal(a.empresaId,"A");
 assert.equal(b.empresaId,"B");
 assert.equal(distintoSecreto.empresaId,"A");
 assert.equal(llamadas,3);
});
test("Capa 2: revocación se respeta al expirar TTL, nunca cachea rechazo",async()=>{
 let version=0,tiempo=1000,llamadas=0;
 const v=crearVerificadorCompartido({
  ahora:()=>tiempo,
  verificar:async()=>{llamadas++;return version===0?perfil:null;}
 });
 assert.ok(await v.autenticar({token:"A",secret:"s"}));
 version=1;
 assert.ok(await v.autenticar({token:"A",secret:"s"}));
 tiempo+=351;
 assert.equal(await v.autenticar({token:"A",secret:"s"}),null);
 assert.equal(await v.autenticar({token:"A",secret:"s"}),null);
 assert.equal(llamadas,3);
});
test("Capa 2: solicitud abortada no hereda autorización compartida",async()=>{
 let liberar;
 const pendiente=new Promise(resolve=>liberar=resolve);
 const v=crearVerificadorCompartido({verificar:async()=>{await pendiente;return perfil;}});
 const controller=new AbortController();
 const primero=v.autenticar({token:"A",secret:"s"});
 const segundo=v.autenticar({token:"A",secret:"s",signal:controller.signal});
 controller.abort();
 liberar();
 assert.equal(await primero,perfil);
 assert.equal(await segundo,null);
 assert.equal(await v.autenticar({token:"A",secret:"s",signal:controller.signal}),null);
});
test("Capa 2: rechaza exceso de entradas, limpia expiradas y no acumula errores",async()=>{
 let tiempo=1000;
 const v=crearVerificadorCompartido({
  maxEntradas:1,ahora:()=>tiempo,
  verificar:async()=>perfil
 });
 assert.ok(await v.autenticar({token:"A",secret:"s"}));
 assert.equal(await v.autenticar({token:"B",secret:"s"}),null);
 assert.equal(v.estadisticas().rechazos,1);
 tiempo+=400;
 assert.ok(await v.autenticar({token:"B",secret:"s"}));
 assert.equal(v.estadisticas().entradas,1);
});
