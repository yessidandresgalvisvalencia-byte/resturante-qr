"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root=path.resolve(__dirname,"../..");
const manifest=JSON.parse(fs.readFileSync(path.join(root,"package.json"),"utf8"));
const lock=JSON.parse(fs.readFileSync(path.join(root,"package-lock.json"),"utf8"));

test("package-lock conserva las dependencias exactas del manifiesto",()=>{
 assert.equal(lock.lockfileVersion,3);
 assert.ok(lock.packages && lock.packages[""],"Falta paquete raíz en package-lock");
 for(const campo of ["dependencies","devDependencies","engines"]){
  assert.deepEqual(lock.packages[""][campo]||{},manifest[campo]||{},
   `Desalineación ${campo}: npm ci puede fallar`);
 }
});

test("la rama personal conserva comandos de prueba de seguridad y el gate",()=>{
 assert.match(manifest.scripts.gate,/npm run check:syntax && npm test/);
 assert.match(manifest.scripts["build:personal"],/npm run test:finanzas-personales/);
 assert.match(manifest.scripts["test:finanzas-personales"],/decision-proof-custodian-input\.test\.js/);
 assert.match(manifest.scripts["check:personal"],/auditoriaAnclaCustodiada\.service\.js/);
});
