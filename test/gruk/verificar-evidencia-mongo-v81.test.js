"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {validarEvidenciaMongoV81}=require("../../scripts/verificar-evidencia-mongo-v81");
const resumen=`TAP version 13
ok 1 - Mongo local: dos confirmaciones idénticas crean exactamente un vínculo
ok 2 - DecisionProof serializa dos escrituras concurrentes sin huérfanos
1..2
# tests 2
# pass 2
# fail 0
# cancelled 0
# skipped 0
# todo 0
`;
test("exige ejecución verdadera de ambas integraciones Mongo",()=>{
 assert.deepEqual(validarEvidenciaMongoV81(resumen),{
  pruebas:2,aprobadas:2,fallidas:0,omitidas:0
 });
});
test("bloquea cualquier test omitido aunque las demás pruebas pasen",()=>{
 assert.throws(()=>validarEvidenciaMongoV81(resumen.replace("# pass 2","# pass 1").replace("# skipped 0","# skipped 1")),/MONGO_V81_NO_APROBADO/);
});
test("bloquea ausencia de la prueba de cadena auditada",()=>{
 assert.throws(()=>validarEvidenciaMongoV81(resumen.replace("DecisionProof serializa dos escrituras concurrentes sin huérfanos","otra prueba")),/PRUEBA_MONGO_OBLIGATORIA_AUSENTE/);
});
test("rechaza resúmenes TAP ausentes, duplicados o con fallos",()=>{
 assert.throws(()=>validarEvidenciaMongoV81(""),/RESUMEN_TAP_AUSENTE/);
 assert.throws(()=>validarEvidenciaMongoV81(resumen+"# tests 2\n"),/RESUMEN_TAP_AUSENTE_O_DUPLICADO/);
 assert.throws(()=>validarEvidenciaMongoV81(resumen.replace("# pass 2","# pass 1").replace("# fail 0","# fail 1")),/MONGO_V81_NO_APROBADO/);
});

test("rechaza numeración duplicada, plan falso y pruebas no exitosas",()=>{
 const duplicado=resumen.replace("ok 2 - ","ok 1 - ");
 assert.throws(()=>validarEvidenciaMongoV81(duplicado),/RESULTADO_TAP_INVALIDO/);
 assert.throws(()=>validarEvidenciaMongoV81(resumen.replace("1..2","1..3")),/PLAN_TAP_INVALIDO/);
 assert.throws(()=>validarEvidenciaMongoV81(resumen.replace("ok 2 - ","not ok 2 - ")),/RESULTADO_TAP_INVALIDO/);
 assert.throws(()=>validarEvidenciaMongoV81(resumen.replace("ok 2 - ","ok 3 - ")),/RESULTADO_TAP_INVALIDO/);
});
test("rechaza pruebas omitidas incluso con resumen falsamente aprobado",()=>{
 const falso=resumen.replace(
  "ok 2 - DecisionProof serializa dos escrituras concurrentes sin huérfanos",
  "ok 2 - DecisionProof serializa dos escrituras concurrentes sin huérfanos # SKIP"
 );
 assert.throws(()=>validarEvidenciaMongoV81(falso),/RESULTADO_TAP_INVALIDO/);
 assert.throws(()=>validarEvidenciaMongoV81(resumen.replace("ok 2 - ","ok 2 - Otra prueba: ").replace("1..2\n","")),/PLAN_TAP_INVALIDO/);
});

test("bloquea reportes TAP cancelados, pendientes o sin esos contadores",()=>{
 assert.throws(()=>validarEvidenciaMongoV81(resumen.replace("# cancelled 0","# cancelled 1")),/MONGO_V81_NO_APROBADO/);
 assert.throws(()=>validarEvidenciaMongoV81(resumen.replace("# todo 0","# todo 1")),/MONGO_V81_NO_APROBADO/);
 assert.throws(()=>validarEvidenciaMongoV81(resumen.replace("# cancelled 0\n","")),/RESUMEN_TAP_AUSENTE/);
 assert.throws(()=>validarEvidenciaMongoV81(resumen.replace("# todo 0\n","")),/RESUMEN_TAP_AUSENTE/);
});

test("valida TAP generado por el propio Node al ejecutar dos archivos",()=>{
 const fs=require("node:fs"),os=require("node:os"),path=require("node:path");
 const {spawnSync}=require("node:child_process");
 const raiz=fs.mkdtempSync(path.join(os.tmpdir(),"gruk-v81-tap-"));
 try{
  const primero=path.join(raiz,"vinculos.test.cjs");
  const segundo=path.join(raiz,"decision.test.cjs");
  fs.writeFileSync(primero,
   'const t=require("node:test");t("Mongo local: dos confirmaciones idénticas crean exactamente un vínculo",()=>{});\n');
  fs.writeFileSync(segundo,
   'const t=require("node:test");t("DecisionProof serializa dos escrituras concurrentes sin huérfanos",()=>{});\n');
  const ejecucion=spawnSync(process.execPath,
   ["--test","--test-reporter=tap",primero,segundo],
   {encoding:"utf8",timeout:10000,
    env:Object.fromEntries(Object.entries(process.env).filter(([k])=>k!=="NODE_TEST_CONTEXT"))});
  assert.equal(ejecucion.status,0,ejecucion.stderr);
  assert.match(ejecucion.stdout,/^# tests 2$/m,
   "El subproceso Node no emitió el resumen TAP esperado: "+ejecucion.stdout+" "+ejecucion.stderr);
  assert.deepEqual(validarEvidenciaMongoV81(ejecucion.stdout),{
   pruebas:2,aprobadas:2,fallidas:0,omitidas:0
  });
 }finally{fs.rmSync(raiz,{recursive:true,force:true});}
});
