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
