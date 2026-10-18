"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.join(__dirname,"../..");
test("la puerta de producción instala solamente dependencias necesarias",()=>{
 const ci=fs.readFileSync(path.join(root,".github/workflows/finanzas-personales-ci.yml"),"utf8");
 assert.match(ci,/pruebas-financieras:[\s\S]*?npm ci --omit=dev/);
 assert.match(ci,/auditoria-dependencias:[\s\S]*?npm ci --omit=dev/);
 assert.match(ci,/npm audit --omit=dev --audit-level=high --json/);
 assert.match(ci,/npm run check:personal 2>&1/);
 assert.match(ci,/npm run test:finanzas-personales 2>&1/);
 assert.match(ci,/set -o pipefail/);
});
test("la auditoría de desarrollo mantiene una evidencia independiente",()=>{
 const ci=fs.readFileSync(path.join(root,".github/workflows/finanzas-personales-ci.yml"),"utf8");
 assert.match(ci,/auditoria-desarrollo:/);
 assert.match(ci,/name: auditoria-dependencias-desarrollo-finanzas/);
 assert.match(ci,/name: auditoria-dependencias-produccion-finanzas/);
});
test("el script de arranque de producción no necesita nodemon",()=>{
 const p=JSON.parse(fs.readFileSync(path.join(root,"package.json"),"utf8"));
 assert.equal(p.scripts["start:personal"],"node modules/finanzas-personales/server.js");
});

test("los cambios a las guardias financieras no pueden evadir el CI de pull requests",()=>{
 const ci=fs.readFileSync(path.join(root,".github/workflows/finanzas-personales-ci.yml"),"utf8");
 const pullRequest=ci.split("  pull_request:")[1]?.split("\npermissions:")[0];
 assert.ok(pullRequest,"Falta configuración pull_request");
 for(const ruta of [
  "scripts/verificar-evidencia-mongo-v81.js",
  "scripts/gate-construccion-finanzas-personales.js",
  "scripts/auditoria-instalacion-personal.js"
 ])assert.ok(pullRequest.includes("'"+ruta+"'"),"CI no cubre cambios en "+ruta);
});

test("CI Mongo conserva TAP verificable y evidencia visible de sus dos integraciones",()=>{
 const ci=fs.readFileSync(path.join(root,".github/workflows/finanzas-personales-ci.yml"),"utf8");
 const bloque=ci.split("  concurrencia-mongo:")[1];
 assert.ok(bloque,"Falta el trabajo de concurrencia");
 assert.match(bloque,/node --test --test-reporter=tap test\/gruk\/confirmacion-vinculo-mongo-concurrencia\.test\.js test\/gruk\/decision-proof-concurrency\.test\.js/);
 assert.ok(bloque.includes('node scripts/verificar-evidencia-mongo-v81.js prueba-mongo-v81.log | tee comprobante-mongo-v81.txt | tee -a "$GITHUB_STEP_SUMMARY"'));
 assert.ok(bloque.includes("comprobante-mongo-v81.txt"));
 assert.ok(bloque.includes("if-no-files-found: error"));
 assert.match(bloque,/set -o pipefail/);
 assert.match(bloque,/name: evidencia-concurrencia-mongo-v81/);
});
