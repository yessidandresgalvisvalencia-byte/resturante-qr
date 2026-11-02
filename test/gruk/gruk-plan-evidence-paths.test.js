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
  fs.writeFileSync(path.join(dir,"test/gruk/evidence.test.js"),"");
  assert.throws(() => validateEvidencePaths(row("https://github.com/otro/otro/pull/522 test/gruk/evidence.test.js criterio de aceptación"),dir),/UNTRUSTED_EVIDENCE_URL_01/);
 } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
test("acepta evidencia con enlace correcto y archivo de prueba real, sin certificar ejecución", () => {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(),"gruk-evidence-"));
 try {
  fs.mkdirSync(path.join(dir,"test/gruk"),{recursive:true});
  fs.writeFileSync(path.join(dir,"test/gruk/evidence.test.js"),"");
  assert.equal(validateEvidencePaths(row(goodLink + " test/gruk/evidence.test.js criterio de aceptación"),dir),true);
 } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
