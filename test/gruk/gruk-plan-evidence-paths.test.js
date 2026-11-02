"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { validateEvidencePaths } = require("../../scripts/gruk-plan-master-audit.js");
const row = evidence => "| 01 | P0 | Separación | VERIFICADO | " + evidence + " |";
const goodLink = "https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/pull/522";
test("rechaza evidencias con test inexistente", () => {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(),"gruk-evidence-"));
 try {
  assert.throws(() => validateEvidencePaths(row(goodLink + " test/gruk/no-existe.test.js criterio de aceptación"),dir),/MISSING_EVIDENCE_TEST_01/);
 } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
test("rechaza URL de repositorio ajeno aunque el test exista", () => {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(),"gruk-evidence-"));
 try {
  fs.mkdirSync(path.join(dir,"test/gruk"),{recursive:true});
  fs.writeFileSync(path.join(dir,"test/gruk/evidence.test.js"),'const test=require("node:test"); test("evidencia",()=>{});');
  assert.throws(() => validateEvidencePaths(row("https://github.com/otro/otro/pull/522 test/gruk/evidence.test.js criterio de aceptación"),dir),/UNTRUSTED_EVIDENCE_URL_01/);
 } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
test("acepta evidencia con enlace correcto y archivo de prueba real, sin certificar ejecución", () => {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(),"gruk-evidence-"));
 try {
  fs.mkdirSync(path.join(dir,"test/gruk"),{recursive:true});
  fs.writeFileSync(path.join(dir,"test/gruk/evidence.test.js"),'const test=require("node:test"); test("evidencia",()=>{});');
  assert.equal(validateEvidencePaths(row(goodLink + " test/gruk/evidence.test.js criterio de aceptación"),dir),true);
 } finally {fs.rmSync(dir,{recursive:true,force:true});}
});

test("rechaza symlink a prueba fuera del directorio test", () => {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(),"gruk-evidence-"));
 try {
  fs.mkdirSync(path.join(dir,"test/gruk"),{recursive:true});
  fs.writeFileSync(path.join(dir,"outside.test.js"),"");
  fs.symlinkSync(path.join(dir,"outside.test.js"),path.join(dir,"test/gruk/evidence.test.js"));
  assert.throws(() => validateEvidencePaths(row(goodLink + " test/gruk/evidence.test.js criterio de aceptación"),dir),/MISSING_EVIDENCE_TEST_01/);
 } finally {fs.rmSync(dir,{recursive:true,force:true});}
});

test("acepta PR numérico que incluye dígitos 8 y 9", () => {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(),"gruk-evidence-"));
 try {
  fs.mkdirSync(path.join(dir,"test/gruk"),{recursive:true});
  fs.writeFileSync(path.join(dir,"test/gruk/evidence.test.js"),'const test=require("node:test"); test("evidencia",()=>{});');
  assert.equal(validateEvidencePaths(row("https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/pull/589 test/gruk/evidence.test.js"),dir),true);
 } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
test("rechaza URL de PR con sufijo no numérico, sin aceptar prefijo", () => {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(),"gruk-evidence-"));
 try {
  fs.mkdirSync(path.join(dir,"test/gruk"),{recursive:true});
  fs.writeFileSync(path.join(dir,"test/gruk/evidence.test.js"),'const test=require("node:test"); test("evidencia",()=>{});');
  assert.throws(() => validateEvidencePaths(row(goodLink + "x test/gruk/evidence.test.js"),dir),/UNTRUSTED_EVIDENCE_URL_01/);
 } finally {fs.rmSync(dir,{recursive:true,force:true});}
});

test("rechaza evidencia mixta con URL ajena aunque tenga enlace válido", () => {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(),"gruk-evidence-"));
 try {
  fs.mkdirSync(path.join(dir,"test/gruk"),{recursive:true});
  fs.writeFileSync(path.join(dir,"test/gruk/evidence.test.js"),'const test=require("node:test"); test("evidencia",()=>{});');
  const evidence=goodLink+" https://github.com/otro/otro/issues/1 test/gruk/evidence.test.js";
  assert.throws(()=>validateEvidencePaths(row(evidence),dir),/UNTRUSTED_EVIDENCE_URL_01/);
 } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
test("rechaza HTTP y enlace malformado mezclados con URL válida", () => {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(),"gruk-evidence-"));
 try {
  fs.mkdirSync(path.join(dir,"test/gruk"),{recursive:true});
  fs.writeFileSync(path.join(dir,"test/gruk/evidence.test.js"),'const test=require("node:test"); test("evidencia",()=>{});');
  for (const extra of ["http://github.com/yessidandresgalvisvalencia-byte/resturante-qr/pull/522",
   "https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/pull/522extra"]) {
   assert.throws(()=>validateEvidencePaths(row(goodLink+" "+extra+" test/gruk/evidence.test.js"),dir),/UNTRUSTED_EVIDENCE_URL_01/);
  }
 } finally {fs.rmSync(dir,{recursive:true,force:true});}
});

test("rechaza archivo vacío usado como evidencia de aceptación", () => {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"gruk-evidence-"));
 try {
  fs.mkdirSync(path.join(dir,"test/gruk"),{recursive:true});
  fs.writeFileSync(path.join(dir,"test/gruk/evidence.test.js"),"");
  assert.throws(()=>validateEvidencePaths(row(goodLink+" test/gruk/evidence.test.js criterio de aceptación"),dir),/MISSING_EVIDENCE_TEST_01/);
 } finally {fs.rmSync(dir,{recursive:true,force:true});}
});

test("rechaza evidencia de prueba con sintaxis JavaScript inválida", () => {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"gruk-evidence-"));
 try {
  fs.mkdirSync(path.join(dir,"test/gruk"),{recursive:true});
  fs.writeFileSync(path.join(dir,"test/gruk/evidence.test.js"),'const test=require("node:test"); test("roto", () => {');
  assert.throws(()=>validateEvidencePaths(row(goodLink+" test/gruk/evidence.test.js criterio de aceptación"),dir),/MISSING_EVIDENCE_TEST_01/);
 } finally {fs.rmSync(dir,{recursive:true,force:true});}
});

test("rechaza sufijos y rutas de prueba malformadas mezcladas con una válida", () => {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"gruk-evidence-"));
 try {
  fs.mkdirSync(path.join(dir,"test/gruk"),{recursive:true});
  fs.writeFileSync(path.join(dir,"test/gruk/evidence.test.js"),'const test=require("node:test"); test("evidencia",()=>{});');
  for (const extra of ["test/gruk/false.test.js.evil", "test/../test/gruk/evidence.test.js", "test/gruk/evidence.test.js.bak"]) {
   assert.throws(() => validateEvidencePaths(row(goodLink+" test/gruk/evidence.test.js "+extra+" criterio de aceptación"),dir),/MISSING_EVIDENCE_TEST_01/);
  }
 } finally {fs.rmSync(dir,{recursive:true,force:true});}
});

test("rechaza rutas de evidencia inválidas después de puntuación", () => {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"gruk-evidence-"));
 try {
  fs.mkdirSync(path.join(dir,"test/gruk"),{recursive:true});
  fs.writeFileSync(path.join(dir,"test/gruk/evidence.test.js"),'const test=require("node:test"); test("evidencia",()=>{});');
  for (const extra of [",test/gruk/falso.test.js.evil", ";test/../test/gruk/evidence.test.js"]) {
   assert.throws(() => validateEvidencePaths(row(goodLink+" test/gruk/evidence.test.js "+extra+" criterio de aceptación"),dir),/MISSING_EVIDENCE_TEST_01/);
  }
 } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
