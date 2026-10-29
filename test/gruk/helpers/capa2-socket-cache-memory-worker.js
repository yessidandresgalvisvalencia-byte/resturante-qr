"use strict";
// Worker aislado: --expose-gc para mediciones comparables. No Mongo ni JWT reales.
const assert=require("node:assert/strict");
const {crearVerificadorCompartido}=require("../../../core/auth/socketSharedVerifier.service");
async function main(){
 if(typeof global.gc!=="function")throw Error("GC_NO_DISPONIBLE");
 let clock=1000;
 const maxEntradas=512, ttlMs=350, ciclos=12;
 const verifier=crearVerificadorCompartido({
  maxEntradas,ttlMs,ahora:()=>clock,
  verificar:async({token})=>({
   usuarioId:token,empresaId:token.includes("-B-")?"B":"A",
   sedeId:null,rol:"EMPLEADO",identityType:"USUARIO",tokenVersion:0
  })
 });
 global.gc();
 const inicial=process.memoryUsage();
 let pico=0;
 for(let ciclo=0;ciclo<ciclos;ciclo++){
  const tokens=Array.from({length:maxEntradas},(_,i)=>
   "jwt-"+ciclo+"-"+(i%2?"B":"A")+"-"+i+"-"+("x".repeat(240))
  );
  const resultados=await Promise.all(tokens.map(token=>
   verifier.autenticar({token,secret:"secret-solo-ci"})
  ));
  assert.equal(resultados.length,maxEntradas);
  assert.ok(resultados.every(Boolean),"Todos los JWT nuevos se validan tras expirar el ciclo anterior");
  assert.equal(verifier.estadisticas().entradas,maxEntradas);
  const otro=await verifier.autenticar({token:"jwt-rechazado-"+ciclo,secret:"secret-solo-ci"});
  assert.equal(otro,null,"Caché al límite rechaza el JWT adicional sin autorizarlo");
  assert.equal(verifier.estadisticas().entradas,maxEntradas);
  pico=Math.max(pico,process.memoryUsage().heapUsed);
  clock+=ttlMs+1;
 }
 // Se podan todas las entradas expiradas durante el siguiente acceso.
 assert.ok(await verifier.autenticar({token:"jwt-final-B",secret:"secret-solo-ci"}));
 assert.equal(verifier.estadisticas().entradas,1);
 global.gc();global.gc();
 const final=process.memoryUsage();
 const crecimientoHeapBytes=final.heapUsed-inicial.heapUsed;
 // Umbral deliberadamente holgado para detectar retenciones masivas;
 // NO reemplaza perfilado de memoria / estrés en producción.
 const limiteBytes=16*1024*1024;
 assert.ok(crecimientoHeapBytes<limiteBytes,
  "El heap retenido superó el umbral de seguridad de CI de 16 MiB");
 assert.equal(verifier.estadisticas().rechazos,ciclos);
 console.log("[GRUK CI SOCKET CACHE HEAP]",JSON.stringify({
  ciclos,jwtDistintos:ciclos*maxEntradas,capacidad:maxEntradas,
  entradasFinales:verifier.estadisticas().entradas,
  rechazos:verifier.estadisticas().rechazos,
  heapInicialBytes:inicial.heapUsed,
  heapFinalBytes:final.heapUsed,
  crecimientoHeapBytes,picoHeapObservadoBytes:pico,
  limiteCrecimientoBytes:limiteBytes,
  nota:"heapUsed tras GC aislado; no es medición RSS ni SLA"
 }));
}
main().catch(error=>{
 console.error("[GRUK CI SOCKET CACHE HEAP FAIL]",error.stack||error.message);
 process.exitCode=1;
});
