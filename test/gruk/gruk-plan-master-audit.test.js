"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { validate } = require("../../scripts/gruk-plan-master-audit.js");
const root = path.join(__dirname, "../..");
const criteria = fs.readFileSync(path.join(root,"docs/GRUK_PLAN_MAESTRO_77_CRITERIOS.md"),"utf8");
const matrix = fs.readFileSync(path.join(root,"docs/GRUK_PLAN_MAESTRO_77_TRAZABILIDAD.md"),"utf8");
test("Word maestro: 77 criterios originales y matriz completa en orden", () => {
 const r = validate(criteria,matrix);
 assert.equal(r.total,77);
 assert.equal(r.releaseAuthorized,false);
 assert.equal(Object.values(r.counts).reduce((a,b)=>a+b,0),77);
});
test("Word maestro: impide omitir un requisito", () => {
 const missing = criteria.replace(/^\|\s*77\s*\|.*\n/m,"");
 assert.throws(()=>validate(missing,matrix),/77_ROWS_REQUIRED/);
});
test("Word maestro: impide declarar VERIFICADO sin evidencia", () => {
 const tampered = matrix.replace(/(\|\s*01\s*\|\s*P0\s*\|[^|]+\|)\s*SIN_AUDITAR\s*\|/, "$1 VERIFICADO |");
 assert.notEqual(tampered,matrix);
 assert.throws(()=>validate(criteria,tampered),/UNSUPPORTED_VERIFIED_01/);
});
test("Word maestro: detecta cambios de prioridad y criterio", () => {
 const wrongPriority = criteria.replace(/(\|\s*01\s*\|)\s*P0\s*\|/,"$1 P2 |");
 assert.throws(()=>validate(wrongPriority,matrix),/PRIORITY_MISMATCH_01/);
 const wrongCriterion = criteria.replace(/(\|\s*01\s*\|[^|\n]+\|[^|\n]+\|[^|\n]+\|)[^|\n]+\|/,"$1 |");
 assert.notEqual(wrongCriterion,criteria);
 assert.throws(()=>validate(wrongCriterion,matrix),/CRITERION_MISMATCH_01/);
});
test("Word maestro: no permite filas duplicadas o sin identificador estable", () => {
 const duplicate = matrix.replace(/^\|\s*02\s*\|/m,"| 01 |");
 assert.throws(()=>validate(criteria,duplicate),/ID_ORDER_02/);
});
