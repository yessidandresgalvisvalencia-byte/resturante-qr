"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const yaml=fs.readFileSync(path.resolve(__dirname,"../../.github/workflows/finanzas-personales-v81.yml"),"utf8");

test("CI V81 se dispara por cambios en firmas, custodio y pruebas del ledger",()=>{
 for(const ruta of [
  "modules/finanzas-personales/security/**",
  "modules/finanzas-personales/services/anclaDecisionMongo.service.js",
  "modules/finanzas-personales/services/auditoria*.service.js",
  "test/gruk/decision-proof-*.test.js",
  "test/gruk/package-lock-contract.test.js"
 ]){
  const escaped=ruta.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  assert.match(yaml,new RegExp(escaped),ruta);
 }
});

test("CI V81 ejecuta los contratos offline de seguridad",()=>{
 for(const archivo of [
  "decision-proof-chain-integrity.test.js",
  "decision-proof-external-anchor.test.js",
  "decision-proof-db-privileges.test.js",
  "decision-proof-custodian-input.test.js",
  "package-lock-contract.test.js",
  "shared-entrypoint-contract.test.js"
 ]){
  assert.match(yaml,new RegExp(archivo.replaceAll(".","\\.")),archivo);
 }
 assert.match(yaml,/node --test test\/finanzas-personales\/\*\.test\.js/);
});

test("CI V81 prueba DecisionProof contra MongoDB local con confirmación explícita",()=>{
 assert.match(yaml,/node --test test\/gruk\/decision-proof-concurrency\.test\.js/);
 assert.match(yaml,/TEST_MONGO_URI: mongodb:\/\/127\.0\.0\.1:27017\/\?replicaSet=rs0&directConnection=true/);
 assert.match(yaml,/GRUK_TEST_DB_CONFIRM: SOLO_PRUEBAS_LOCALES/);
 assert.match(yaml,/name: Limpiar MongoDB aislado/);
});

test("el trabajo V81 verifica sintaxis de todo el vertical financiero",()=>{
 assert.match(yaml,/name: Verificar sintaxis de servicios financieros y auditorías\s*\n\s*run: npm run check:personal/);
});

test("V81 usa la misma versión Node que declara package.json",()=>{
 const fs=require("node:fs");
 const path=require("node:path");
 const manifest=require(path.resolve(__dirname,"../../package.json"));
 const expected=manifest.engines.node.match(/^(\d+)/)?.[1];
 assert.ok(expected,"package.json debe declarar la versión mayor de Node");
 const configured=[...yaml.matchAll(/node-version:\s*['"]?(\d+)/g)].map(m=>m[1]);
 assert.ok(configured.length>=1,"No existen runners Node configurados");
 assert.ok(configured.every(v=>v===expected),
  `Node en CI V81 (${configured.join(",")}) difiere del engine (${expected})`);
});

test("todos los seis jobs V81 prueban el commit fuente y no el merge temporal bloqueado",()=>{
 const checkouts=[...yaml.matchAll(/uses: actions\/checkout@v4/g)];
 const refs=[...yaml.matchAll(/ref: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/g)];
 assert.equal(checkouts.length,6,"Debe auditarse cada job V81");
 assert.equal(refs.length,checkouts.length,
  "Ningún job puede depender de refs/pull/*/merge en una PR con conflictos");
});
