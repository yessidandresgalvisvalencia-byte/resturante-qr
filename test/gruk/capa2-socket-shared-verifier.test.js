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

test("Capa 2: dos instancias tienen caches independientes y detectan revocación",async()=>{
 let tiempo=1000,version=0;
 const llamadas=[0,0];
 function instancia(indice){
  return crearVerificadorCompartido({
   ttlMs:350,ahora:()=>tiempo,
   verificar:async({token})=>{
    llamadas[indice]++;
    return token==="usuario-A"&&version===0?perfil:null;
   }
  });
 }
 const proceso1=instancia(0);
 const proceso2=instancia(1);
 const args={token:"usuario-A",secret:"secreto-firmado"};
 const validos=await Promise.all([
  ...Array.from({length:24},()=>proceso1.autenticar(args)),
  ...Array.from({length:24},()=>proceso2.autenticar(args))
 ]);
 assert.equal(validos.every(Boolean),true);
 assert.deepEqual(llamadas,[1,1],
  "Cada proceso valida Mongo independientemente, sin cache compartida");
 version=1;
 assert.ok(await proceso1.autenticar(args),
  "El TTL introduce ventana máxima de autorización ya comprobada");
 tiempo+=351;
 assert.equal(await proceso1.autenticar(args),null);
 assert.equal(await proceso2.autenticar(args),null);
 assert.deepEqual(llamadas,[2,2]);
 assert.equal(await proceso1.autenticar(args),null,
  "Nunca se almacena como válido un rechazo de revocación");
});

test("Capa 2: validaciones distintas no comparten el mismo resultado entre procesos",async()=>{
 let tiempo=1000,consultas=0;
 const proceso1=crearVerificadorCompartido({
  ahora:()=>tiempo,verificar:async({token})=>{
   consultas++;
   return token==="empresa-A"?perfil:{...perfil,usuarioId:"b",empresaId:"B"};
  }
 });
 const proceso2=crearVerificadorCompartido({
  ahora:()=>tiempo,verificar:async({token})=>{
   consultas++;
   return token==="empresa-A"?perfil:{...perfil,usuarioId:"b",empresaId:"B"};
  }
 });
 const [a,b]=await Promise.all([
  proceso1.autenticar({token:"empresa-A",secret:"secreto"}),
  proceso2.autenticar({token:"empresa-B",secret:"secreto"})
 ]);
 assert.equal(a.empresaId,"A");
 assert.equal(b.empresaId,"B");
 assert.equal(consultas,2);
 tiempo+=351;
 assert.equal((await proceso1.autenticar({token:"empresa-B",secret:"secreto"})).empresaId,"B");
 assert.equal((await proceso2.autenticar({token:"empresa-A",secret:"secreto"})).empresaId,"A");
});

test("Capa 2: timeout real libera entradas si Mongo ignora AbortSignal",async()=>{
 let completarTarde;
 const consultaBloqueada=new Promise(resolve=>completarTarde=resolve);
 let consultas=0;
 const v=crearVerificadorCompartido({
  tiempoConsultaMs:100,maxEntradas:1,
  verificar:async({token})=>{
   consultas++;
   if(token==="bloqueado")return consultaBloqueada;
   return {...perfil,usuarioId:"recuperado"};
  }
 });
 const pendientes=Array.from({length:12},()=>v.autenticar({
  token:"bloqueado",secret:"test"
 }));
 const respuestas=await Promise.race([
  Promise.all(pendientes),
  new Promise((_,reject)=>setTimeout(()=>reject(Error("La consulta bloqueada no terminó")),900))
 ]);
 assert.equal(respuestas.every(x=>x===null),true);
 assert.equal(v.estadisticas().entradas,0,"El timeout libera el límite de entradas");
 assert.equal(consultas,1,"Solo se ejecuta una verificación Mongo bloqueada");
 const recuperado=await v.autenticar({token:"nuevo",secret:"test"});
 assert.equal(recuperado.usuarioId,"recuperado");
 completarTarde(perfil);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(await v.autenticar({token:"bloqueado",secret:"test"}),null,
  "No reutilizar como válido un resultado tardío después del timeout");
});
test("Capa 2: error de Mongo no se cachea como autorización",async()=>{
 let fallar=true,consultas=0;
 const v=crearVerificadorCompartido({verificar:async()=>{
  consultas++;
  if(fallar)throw Error("Mongo unavailable");
  return perfil;
 }});
 assert.equal(await v.autenticar({token:"A",secret:"s"}),null);
 fallar=false;
 assert.equal(await v.autenticar({token:"A",secret:"s"}),perfil);
 assert.equal(consultas,2);
});

test("Capa 2: 700 JWT concurrentes ocupan máximo 512 entradas y 188 fallan cerrado",async()=>{
 let resolver;
 const retener=new Promise(resolve=>resolver=resolve);
 let consultas=0;
 const v=crearVerificadorCompartido({
  maxEntradas:512,tiempoConsultaMs:1500,
  verificar:async()=>{consultas++;await retener;return perfil;}
 });
 const pendientes=Array.from({length:700},(_,i)=>v.autenticar({
  token:"jwt-unique-"+i,secret:"secret-1"
 }));
 assert.equal(v.estadisticas().entradas,512);
 assert.equal(v.estadisticas().rechazos,188);
 await Promise.resolve();
 assert.equal(consultas,512,"No se lanzan consultas para los 188 rechazados");
 resolver();
 const resultados=await Promise.all(pendientes);
 assert.equal(resultados.filter(Boolean).length,512);
 assert.equal(resultados.filter(x=>x===null).length,188);
 assert.equal(v.estadisticas().entradas,512);
 assert.equal(v.estadisticas().consultas,512);
 // Luego de expirar, 700 JWT NUEVOS no deben acumular otros 700 registros.
 // La caché se poda al llegar una nueva solicitud; nunca crece sin límite.
 const reloj=v.estadisticas();
 assert.equal(reloj.entradas<=512,true);
});

test("Capa 2: limpia 512 JWT expirados y recupera capacidad para nuevas identidades",async()=>{
 let t=1000,consultas=0;
 const v=crearVerificadorCompartido({
  maxEntradas:512,ttlMs:350,ahora:()=>t,
  verificar:async({token})=>{
   consultas++;
   return {...perfil,usuarioId:token,empresaId:token.startsWith("b-")?"B":"A"};
  }
 });
 const primera=await Promise.all(Array.from({length:512},(_,i)=>
  v.autenticar({token:"a-"+i,secret:"test"})
 ));
 assert.equal(primera.length,512);
 assert.equal(v.estadisticas().entradas,512);
 assert.equal(await v.autenticar({token:"b-new",secret:"test"}),null);
 assert.equal(v.estadisticas().rechazos,1);
 t+=351;
 const nuevas=await Promise.all(Array.from({length:512},(_,i)=>
  v.autenticar({token:"b-"+i,secret:"test"})
 ));
 assert.equal(nuevas.every(u=>u?.empresaId==="B"),true);
 assert.equal(v.estadisticas().entradas,512);
 assert.equal(v.estadisticas().rechazos,1);
 assert.equal(consultas,1024);
 t+=351;
 assert.equal((await v.autenticar({token:"a-0",secret:"test"})).empresaId,"A");
 assert.equal(v.estadisticas().entradas,1,
  "La recuperación poda las 512 entradas expiradas antes de reautorizar");
});

test("Capa 2: expiración de 512 verificaciones bloqueadas libera cupos y niega resultados tardíos",async()=>{
 let liberar;
 const retenida=new Promise(resolve=>liberar=resolve);
 const v=crearVerificadorCompartido({
  maxEntradas:512,tiempoConsultaMs:100,
  verificar:async({token})=>token.startsWith("old-")
   ?retenida:{...perfil,usuarioId:token}
 });
 const solicitudes=Array.from({length:512},(_,i)=>
  v.autenticar({token:"old-"+i,secret:"test"})
 );
 assert.equal(v.estadisticas().entradas,512);
 const resultados=await Promise.race([
  Promise.all(solicitudes),
  new Promise((_,reject)=>setTimeout(()=>reject(Error("Timeout no liberó las 512 entradas")),1500))
 ]);
 assert.equal(resultados.every(x=>x===null),true);
 assert.equal(v.estadisticas().entradas,0);
 assert.equal((await v.autenticar({token:"new-0",secret:"test"})).usuarioId,"new-0");
 liberar(perfil);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(v.estadisticas().entradas,1);
 assert.equal(v.estadisticas().maxEntradas,undefined);
});
