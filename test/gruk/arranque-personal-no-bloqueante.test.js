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
