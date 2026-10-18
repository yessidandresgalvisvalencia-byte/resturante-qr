"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
test("arranque HTTP no espera a macro, cobros ni outbox",()=>{
 const fuente=fs.readFileSync(path.join(__dirname,"../../modules/finanzas-personales/server.js"),"utf8");
 for(const patron of [
  /await macroCollector\.persistColombia\(/,
  /await runCobros\(/,
  /await runOutbox\(/
 ])assert.doesNotMatch(fuente,patron);
 for(const patron of [
  /Promise\.resolve\(\)\.then\(\(\)=>macroCollector\.persistColombia\(\)\)/,
  /void runCobros\(\)/,
  /void runOutbox\(\)/,
  /\[MACRO_COLLECTOR\]/,
  /\[RECORDATORIOS_COBRO\]/,
  /\[FIN_PERSONAL_OUTBOX\]/
 ])assert.match(fuente,patron);
});

test("healthz falla cerrado si Mongo está desconectado o faltan índices",()=>{
 const fuente=fs.readFileSync(path.join(__dirname,"../../modules/finanzas-personales/server.js"),"utf8");
 assert.match(fuente,/let indicesVerificados=false/);
 assert.match(fuente,/indicesVerificados=auditoria\.integridadIndices==="VERIFICADA"/);
 assert.match(fuente,/mongoose\.connection\.readyState===1&&indicesVerificados/);
 assert.match(fuente,/status\(ok\?200:503\)/);
 assert.match(fuente,/Cache-Control","no-store"/);
});

test("servicio financiero se niega a escuchar si los índices no están verificados",()=>{
 const fuente=fs.readFileSync(path.join(__dirname,"../../modules/finanzas-personales/server.js"),"utf8");
 const validacion=fuente.indexOf('throw new Error("INDICES_FINANCIEROS_NO_VERIFICADOS")');
 const escuchar=fuente.indexOf('server.listen(port,"0.0.0.0",resolve)');
 assert.ok(validacion>0,"Falta bloqueo de integridad");
 assert.ok(escuchar>validacion,"El servidor abre el puerto antes del bloqueo de integridad");
 assert.match(fuente,/if\(!indicesVerificados\)\{/);
});
