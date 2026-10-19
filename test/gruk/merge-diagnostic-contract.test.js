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
 assert.match(script,/echo "CONFLICTOS_DE_FUSION_DETECTADOS[^\n]*\n(?:\s*echo "[^\n]*"\n)*\s*exit 1/);
 assert.match(script,/RUTA_GUIA: docs\/finanzas-personales\/integracion-segura-main\.md/);
 assert.match(script,/--name-only/);
 assert.doesNotMatch(script,/^\s*git (?:merge|reset|push|checkout|rebase)\s/m);
});

test("CI publica el informe aun si fallan otras pruebas",()=>{
 assert.match(ci,/fetch-depth: 0/);
 assert.match(ci,/git fetch --no-tags origin \+refs\/heads\/main:refs\/remotes\/origin\/main/);
 assert.match(ci,/\+refs\/heads\/feature\/finanzas-personales:refs\/remotes\/origin\/feature\/finanzas-personales/);
 assert.match(ci,/set -o pipefail/);
 assert.match(ci,/bash scripts\/diagnose-personal-merge\.sh/);
 assert.match(ci,/merge-readiness:\s*\n\s*name: GRUK Personal Merge Readiness\s*\n\s*if: github\.ref == 'refs\/heads\/feature\/finanzas-personales'/);
 assert.match(ci,/name: Publicar informe aunque existan conflictos\s*\n\s*if: always\(\)/);
 assert.match(ci,/gruk-personal-merge-diagnostic\.log/);
});

test("los workflows principales permiten repetición manual sin nuevos commits",()=>{
 const v81=fs.readFileSync(path.join(root,".github/workflows/finanzas-personales-v81.yml"),"utf8");
 for(const [nombre,workflow] of [["GRUK CI",ci],["Finanzas V81",v81]]){
  assert.match(workflow,/^on:\s*\n\s+workflow_dispatch:\s*$/m,nombre);
 }
});

test("merge-readiness exige el SHA exacto del evento GitHub",()=>{
 assert.match(ci,/GRUK_EXPECTED_HEAD_SHA: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/);
 assert.match(script,/DIAGNOSTICO_OBSOLETO/);
 assert.match(script,/exit 3/);
});

test("checkout de diagnóstico no depende de la referencia merge temporal de una PR bloqueada",()=>{
 assert.match(ci,/name: Checkout con historial completo\s*\n\s*uses: actions\/checkout@v4\s*\n\s*with:\s*\n\s*fetch-depth: 0\s*\n\s*ref: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/);
});

test("gate prueba SHA de la PR personal sin cambiar checkout de otras PR",()=>{
 assert.match(ci,/name: GRUK Production Gate[\s\S]*?name: Checkout\s*\n\s*uses: actions\/checkout@v4\s*\n\s*with:\s*\n\s*fetch-depth: 0\s*\n\s*#[^\n]*\n\s*ref: \$\{\{ github\.event\.pull_request\.head\.ref == 'feature\/finanzas-personales' && github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/);
});
