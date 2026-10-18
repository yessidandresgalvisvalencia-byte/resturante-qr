"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname,"../..");
const server = fs.readFileSync(path.join(root,"app.js"),"utf8");
const index = fs.readFileSync(path.join(root,"public/index.html"),"utf8");

test("el arranque compartido conserva salud y readiness de la plataforma",()=>{
 assert.match(server,/app\.get\("\/ready"/);
 assert.match(server,/app\.get\("\/health"/);
 assert.match(server,/mongoose\.connection\.readyState/);
 assert.match(server,/app\.use\("\/api\/sync"/);
});

test("el arranque compartido conserva el bootstrap protegido de índices offline",()=>{
 assert.match(server,/GRUK_OFFLINE_LEDGER_INDEX_BOOTSTRAP/);
 assert.match(server,/ensureOfflineLedgerIndexes/);
});

test("el menú empresarial conserva manifest y registro del service worker",()=>{
 assert.match(index,/rel="manifest"[^>]*href="\/manifest\.json"/);
 assert.match(index,/navigator\.serviceWorker\.register\("\/service-worker\.js"\)/);
});

test("health expone commit real de despliegue sin modificar arranque empresarial",()=>{
 assert.match(server,/const \{getDeploymentCommit\}=require\("\.\/core\/health\/deploymentCommit\.contract"\)/);
 assert.match(server,/commit: getDeploymentCommit\(process\.env\.RENDER_GIT_COMMIT\)/);
 assert.match(server,/app\.use\("\/api", apiRoutes\)/);
});

test("contrato de despliegue existe y valida solo commits SHA-1 completos",()=>{
 const {getDeploymentCommit,verifyDeploymentCommit}=require("../../core/health/deploymentCommit.contract");
 const sha="a".repeat(40);
 assert.equal(getDeploymentCommit(sha),sha);
 assert.equal(verifyDeploymentCommit(sha,sha),true);
 for(const invalid of ["",null,"a".repeat(39),"g".repeat(40),"A".repeat(40)]){
  assert.equal(getDeploymentCommit(invalid),null);
  assert.equal(verifyDeploymentCommit(invalid,sha),false);
 }
});
