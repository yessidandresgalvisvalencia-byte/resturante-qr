"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const root=path.resolve(__dirname,"../..");
const script=fs.readFileSync(path.join(root,"scripts/diagnose-personal-merge.sh"),"utf8");
const ci=fs.readFileSync(path.join(root,".github/workflows/gruk-ci.yml"),"utf8");

test("diagnóstico de PR usa merge-tree sin mutar ni fusionar ramas",()=>{
 assert.match(script,/git merge-tree --write-tree --name-only --messages origin\/main origin\/feature\/finanzas-personales/);
 assert.doesNotMatch(script,/git merge-tree[^\n]*\sHEAD/);
 assert.match(script,/CONFLICTOS_DE_FUSION_DETECTADOS/);
 assert.match(script,/--name-only/);
 assert.doesNotMatch(script,/^\s*git (?:merge|reset|push|checkout|rebase)\s/m);
});

test("CI publica el informe aun si fallan otras pruebas",()=>{
 assert.match(ci,/fetch-depth: 0/);
 assert.match(ci,/git fetch --no-tags origin \+refs\/heads\/main:refs\/remotes\/origin\/main/);
 assert.match(ci,/\+refs\/heads\/feature\/finanzas-personales:refs\/remotes\/origin\/feature\/finanzas-personales/);
 assert.match(ci,/set -o pipefail/);
 assert.match(ci,/bash scripts\/diagnose-personal-merge\.sh/);
 assert.match(ci,/name: Identificar conflictos reales con main sin fusionar\s*\n\s*if: github\.ref == 'refs\/heads\/feature\/finanzas-personales'/);
 assert.match(ci,/name: Guardar informe de conflictos de integración\s*\n\s*if: always\(\) && \(github\.ref == 'refs\/heads\/feature\/finanzas-personales'/);
 assert.match(ci,/gruk-personal-merge-diagnostic\.log/);
});

test("los workflows principales permiten repetición manual sin nuevos commits",()=>{
 const v81=fs.readFileSync(path.join(root,".github/workflows/finanzas-personales-v81.yml"),"utf8");
 for(const [nombre,workflow] of [["GRUK CI",ci],["Finanzas V81",v81]]){
  assert.match(workflow,/^on:\s*\n\s+workflow_dispatch:\s*$/m,nombre);
 }
});
