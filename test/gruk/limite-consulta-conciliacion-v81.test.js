"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {exigirResultadosAcotadosV81,MAX_FILAS_CONCILIACION_V81}=
 require("../../modules/finanzas-personales/services/conciliacionHistoricoCuentaV81.service");
test("la conciliación admite exactamente el máximo y no usa datos recortados",()=>{
 assert.equal(MAX_FILAS_CONCILIACION_V81,25000);
 const aceptadas=Array(MAX_FILAS_CONCILIACION_V81).fill(null);
 assert.equal(exigirResultadosAcotadosV81(aceptadas),aceptadas);
 assert.throws(()=>exigirResultadosAcotadosV81(Array(MAX_FILAS_CONCILIACION_V81+1).fill(null)),
  error=>error.statusCode===409&&/Límite/.test(error.message));
 assert.throws(()=>exigirResultadosAcotadosV81(null),TypeError);
});
test("todas las consultas históricas están acotadas y bloquean antes de conciliar",()=>{
 const source=fs.readFileSync(path.join(__dirname,
  "../../modules/finanzas-personales/services/conciliacionHistoricoCuentaV81.service.js"),"utf8");
 const cortes=(source.match(/\.limit\(MAX_FILAS_CONCILIACION_V81\+1\)/g)||[]).length;
 assert.equal(cortes,5,"Cada una de las 5 consultas debe imponer un límite");
 const controles=(source.match(/exigirResultadosAcotadosV81\((?:rows|vinculos|heredados|sinVinculo|resueltos|\[\.\.\.rows,\.\.\.heredados\])\)/g)||[]).length;
 assert.equal(controles,6,"Debe abortar si alguna fuente pierde registros");
});
