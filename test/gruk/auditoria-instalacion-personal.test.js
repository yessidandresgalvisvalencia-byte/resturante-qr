"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {spawnSync}=require("node:child_process");
const fs=require("node:fs");
const path=require("node:path");
const raiz=path.join(__dirname,"../..");
const script=path.join(raiz,"scripts/auditoria-instalacion-personal.js");
test("auditoría de instalación se puede omitir explícitamente sin contactar el registro",()=>{
 const r=spawnSync(process.execPath,[script],{
  cwd:raiz,env:{...process.env,GRUK_SKIP_INSTALL_AUDIT:"1"},
  timeout:3000,encoding:"utf8"
 });
 assert.equal(r.status,0);
 assert.equal(r.stdout,"");
});
test("GRUK configura el inventario npm después de npm ci",()=>{
 const p=JSON.parse(fs.readFileSync(path.join(raiz,"package.json"),"utf8"));
 assert.equal(p.scripts.postinstall,"node scripts/auditoria-instalacion-personal.js");
});
test("auditoría de instalación nunca reescribe el lockfile",()=>{
 const fuente=fs.readFileSync(script,"utf8");
 assert.match(fuente,/\baudit\b/);
 assert.doesNotMatch(fuente,/audit\s+fix|package-lock-only|writeFile|unlink|rmSync/);
});
