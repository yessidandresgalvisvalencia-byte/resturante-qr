"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const mongoose=require("mongoose");
const {exigirResultadosAcotadosV81,MAX_FILAS_CONCILIACION_V81,crearPipelineVinculosPeriodoV81,fechaContableBogotaV81}=
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
 assert.equal(cortes,3,"Las tres consultas find deben imponer límites");
 assert.match(source,/Vinculo\.aggregate\(crearPipelineVinculosPeriodoV81\(/);
 const controles=(source.match(/exigirResultadosAcotadosV81\((?:rows|vinculos|heredados|sinVinculo|resueltos|\[\.\.\.rows,\.\.\.heredados\])\)/g)||[]).length;
 assert.equal(controles,5,"Debe abortar si alguna fuente pierde registros");
});

test("pipeline filtra usuario, cuenta, intervalo colombiano y luego limita",()=>{
 const usuarioId=new mongoose.Types.ObjectId(),cuentaId=new mongoose.Types.ObjectId();
 const desde=new Date("2025-01-01T05:00:00Z"),hasta=new Date("2025-02-01T05:00:00Z");
 const pipeline=crearPipelineVinculosPeriodoV81({usuarioId,cuentaId,desde,hasta});
 assert.equal(pipeline.length,6);
 assert.deepEqual(pipeline[0],{$match:{usuarioId,cuentaId}});
 assert.equal(pipeline[1].$lookup.localField,"movimientoId");
 assert.equal(pipeline[1].$lookup.foreignField,"_id");
 assert.deepEqual(pipeline[2],{$unwind:"$movimiento"});
 assert.equal(String(pipeline[3].$match["movimiento.usuarioId"]),String(usuarioId));
 assert.equal(pipeline[3].$match["movimiento.cuentaId"],null);
 assert.equal(pipeline[3].$match["movimiento.moneda"],"COP");
 assert.deepEqual(pipeline[3].$match["movimiento.fecha"],{$gte:desde,$lt:hasta});
 assert.deepEqual(pipeline[4],{$replaceRoot:{newRoot:"$movimiento"}});
 assert.deepEqual(pipeline[5],{$limit:MAX_FILAS_CONCILIACION_V81+1});
 assert.throws(()=>crearPipelineVinculosPeriodoV81({usuarioId,cuentaId,desde:hasta,hasta:desde}),TypeError);
 assert.throws(()=>crearPipelineVinculosPeriodoV81({usuarioId:cuentaId,cuentaId:"falso",desde,hasta}),TypeError);
});

test("corte contable de Bogotá respeta límites de medianoche sin desfase UTC",()=>{
 assert.equal(fechaContableBogotaV81(new Date("2025-01-01T04:59:59.999Z")),"2024-12-31");
 assert.equal(fechaContableBogotaV81(new Date("2025-01-01T05:00:00.000Z")),"2025-01-01");
 assert.equal(fechaContableBogotaV81(new Date("2025-02-01T04:59:59.999Z")),"2025-01-31");
 assert.throws(()=>fechaContableBogotaV81("2025-01-01"),TypeError);
 assert.throws(()=>fechaContableBogotaV81(new Date("invalida")),TypeError);
});
test("el formato de Bogotá se construye una vez y no por movimiento",()=>{
 const source=fs.readFileSync(path.join(__dirname,
  "../../modules/finanzas-personales/services/conciliacionHistoricoCuentaV81.service.js"),"utf8");
 assert.equal(source.split("new Intl.DateTimeFormat(").length-1,1);
 assert.ok(source.includes("const fechaContable=fechaContableBogotaV81(row.fecha);"));
});

test("todas las consultas de conciliación tienen presupuesto temporal y nunca usan resultados parciales",()=>{
 const source=fs.readFileSync(path.join(__dirname,
  "../../modules/finanzas-personales/services/conciliacionHistoricoCuentaV81.service.js"),"utf8");
 const {MAX_TIEMPO_CONSULTA_MONGO_V81_MS}=require(
  "../../modules/finanzas-personales/services/conciliacionHistoricoCuentaV81.service");
 assert.equal(MAX_TIEMPO_CONSULTA_MONGO_V81_MS,15000);
 assert.equal(source.split(".maxTimeMS(MAX_TIEMPO_CONSULTA_MONGO_V81_MS)").length-1,4);
 assert.match(source,/Cuenta\.findOne\([\s\S]*?\.session\(session\)\.maxTimeMS\(MAX_TIEMPO_CONSULTA_MONGO_V81_MS\)\.lean\(\)/);
 assert.equal(source.split(".option({maxTimeMS:MAX_TIEMPO_CONSULTA_MONGO_V81_MS})").length-1,1);
 assert.equal(source.split(".limit(MAX_FILAS_CONCILIACION_V81+1)").length-1,3);
 assert.ok(source.includes("{$limit:MAX_FILAS_CONCILIACION_V81+1}"));
});

test("el período máximo admite año bisiesto y rechaza rangos excesivos antes de Mongo",()=>{
 const {exigirPeriodoAcotadoV81,MAX_DIAS_CONCILIACION_V81}=
  require("../../modules/finanzas-personales/services/conciliacionHistoricoCuentaV81.service");
 assert.equal(MAX_DIAS_CONCILIACION_V81,366);
 assert.equal(exigirPeriodoAcotadoV81("2024-01-01","2025-01-01"),true);
 assert.equal(exigirPeriodoAcotadoV81("2025-01-01","2025-01-02"),true);
 for(const [desde,hasta] of [
  ["2024-01-01","2025-01-02"],["2025-01-01","2026-01-03"],
  ["2025-01-01","2025-01-01"],["2025-02-01","2025-01-01"],
  ["2025-02-30","2025-03-02"]
 ])assert.throws(()=>exigirPeriodoAcotadoV81(desde,hasta),TypeError);
});
