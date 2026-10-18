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
