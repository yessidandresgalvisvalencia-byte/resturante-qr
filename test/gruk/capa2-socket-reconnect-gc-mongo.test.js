"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const path=require("node:path");
const {spawnSync}=require("node:child_process");

test("Capa 2: 20 ciclos reales de WebSocket y Mongo en proceso aislado con GC",{
 skip:!(process.env.GRUK_TEST_MONGO_URI||process.env.TEST_MONGO_URI)&&!process.env.CI,
 timeout:90000
},()=>{
 const ruta=path.join(__dirname,"capa2-socket-reconnect-memory-mongo.test.js");
 // Ejecuta únicamente ese fichero, no toda la suite; evita recurrencia.
 const child=spawnSync(process.execPath,["--expose-gc",ruta],{
  encoding:"utf8",timeout:80000,maxBuffer:1024*1024,
  env:{...process.env,NODE_ENV:"test",GRUK_CYCLE_GC_STRESS:"1"}
 });
 assert.equal(child.error,undefined,child.error?.message);
 assert.equal(child.signal,null,"El ensayo real no debe terminar por señal");
 assert.equal(child.status,0,[
  "El ensayo GC falló",child.stdout.slice(-5000),child.stderr.slice(-5000)
 ].join("\n"));
 const registro=child.stdout.split("\n").find(s=>
  s.includes("[GRUK CI SOCKET RECONNECT MEMORY]")
 );
 assert.ok(registro,"La medición real debe dejar evidencia en CI");
 const datos=JSON.parse(registro.slice(registro.indexOf("{")));
 assert.equal(datos.ciclos,20);
 assert.equal(datos.conexionesTotales,480);
 assert.equal(datos.gcForzado,true);
 assert.equal(datos.conexionesFinales,0);
 assert.equal(datos.verificacionesFinales,0);
 assert.equal(datos.entradasCacheFinales,0);
 assert.equal(datos.rssPorCicloBytes.length,20);
 assert.equal(datos.heapPorCicloBytes.length,20);
 const retained=datos.heapPorCicloBytes.at(-1)-datos.heapPorCicloBytes[0];
 assert.ok(retained<16*1024*1024);
 console.log("[GRUK CI SOCKET RECONNECT GC]",JSON.stringify({
  ciclos:20,conexiones:480,
  heapInicialBytes:datos.heapPorCicloBytes[0],
  heapFinalBytes:datos.heapPorCicloBytes.at(-1),
  crecimientoHeapBytes:retained,
  crecimientoRssBytes:datos.crecimientoRssBytes,
  rssPorCicloBytes:datos.rssPorCicloBytes,
  conexionesFinales:datos.conexionesFinales,
  verificacionesFinales:datos.verificacionesFinales,
  entradasCacheFinales:datos.entradasCacheFinales,
  nota:"Proceso aislado con GC; Mongo local de CI, no producción"
 }));
});
