"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const path=require("node:path");
const {spawnSync}=require("node:child_process");

test("Capa 2: heap real medido tras GC en 12 ciclos de JWT únicos",{
 timeout:30000
},()=>{
 const ruta=path.join(__dirname,"helpers/capa2-socket-cache-memory-worker.js");
 const child=spawnSync(process.execPath,["--expose-gc",ruta],{
  encoding:"utf8",timeout:25000,maxBuffer:256*1024,
  env:{...process.env,NODE_ENV:"test"}
 });
 assert.equal(child.error,undefined,child.error?.message);
 assert.equal(child.signal,null,"El worker aislado no debe agotarse por timeout");
 assert.equal(child.status,0,[
  "El worker de memoria terminó con error",child.stdout,child.stderr
 ].join("\n"));
 const salida=child.stdout.split("\n").find(x=>x.includes("[GRUK CI SOCKET CACHE HEAP]"));
 assert.ok(salida,"La medición de heap debe aparecer en el log CI");
 const data=JSON.parse(salida.slice(salida.indexOf("{")));
 assert.equal(data.ciclos,12);
 assert.equal(data.jwtDistintos,6144);
 assert.equal(data.capacidad,512);
 assert.equal(data.entradasFinales,1);
 assert.equal(data.rechazos,12);
 assert.ok(data.crecimientoHeapBytes<data.limiteCrecimientoBytes);
 console.log(salida);
});
