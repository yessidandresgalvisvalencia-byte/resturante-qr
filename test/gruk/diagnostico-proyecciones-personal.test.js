"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const {eventoCompensatorio}=require("../../modules/finanzas-personales/services/eventoCompensatorioPersonal.service");
const {flujoCompensadoPuro}=require("../../modules/finanzas-personales/services/flujoCompensadoPersonal.service");
const {compararProyeccionesPersonal}=require("../../modules/finanzas-personales/services/compararProyeccionesPersonal.service");
const uid="507f1f77bcf86cd799439011";
const gasto={_id:"507f1f77bcf86cd799439012",usuarioId:uid,tipo:"GASTO",
 montoMinor:25000,concepto:"Rappi",categoria:"Comida",moneda:"COP",
 fecha:"2026-10-20T15:00:00.000Z",estado:"ACTIVA",impactoCaja:true};
const compromiso={...gasto,_id:"507f1f77bcf86cd799439013",
 concepto:"Arriendo",montoMinor:500000,impactoCaja:false,recurrente:true};
const pago={...gasto,_id:"507f1f77bcf86cd799439014",
 concepto:"Abono arriendo",montoMinor:200000};
const desde="2026-10-01T00:00:00Z",hasta="2026-11-01T00:00:00Z";
function revisar(movimientos,eventos=[]){
 const verificado=flujoCompensadoPuro({usuarioId:uid,movimientos,eventos,desde,hasta});
 return compararProyeccionesPersonal({usuarioId:uid,movimientos,desde,hasta,verificado});
}
test("sin compensaciones ni obligaciones pendientes las proyecciones coinciden",()=>{
 const r=revisar([gasto]);
 assert.equal(r.coincide,true);
 assert.equal(r.totalesCoinciden,true);
 assert.equal(r.diferenciaVerificadoMenosLegado.flujoNetoMinor,0);
 assert.equal(r.legado.gastosMinor,25000);
});
test("corrección inmutable aparece como diferencia, sin mutar el asiento",()=>{
 const e=eventoCompensatorio({
  original:{usuarioId:uid,movimientoId:gasto._id,tipo:"GASTO",
   montoMinor:25000,concepto:"Rappi",categoria:"Comida"},
  tipo:"CORRECCION",cambios:{montoMinor:22000},
  idempotencyKey:"diagnostico_unico",prevHash:"0".repeat(64),secuencia:1,
  fechaISO:"2026-10-20T16:00:00.000Z"
 });
 const r=revisar([gasto],[e]);
 assert.equal(r.coincide,false);
 assert.equal(r.legado.gastosMinor,25000);
 assert.equal(r.verificado.gastosMinor,22000);
 assert.equal(r.diferenciaVerificadoMenosLegado.flujoNetoMinor,3000);
 assert.equal(r.diferenciaExplicadaPorNoCajaMinor,0);
 assert.equal(r.diferenciaResidualMinor,3000);
 assert.equal(gasto.montoMinor,25000);
});
test("arriendo pendiente no pagado se identifica sin duplicarlo como caja real",()=>{
 const r=revisar([compromiso,pago]);
 assert.equal(r.coincide,false);
 assert.equal(r.legado.gastosMinor,700000);
 assert.equal(r.verificado.gastosMinor,200000);
 assert.equal(r.diferenciaVerificadoMenosLegado.flujoNetoMinor,500000);
 assert.equal(r.obligacionesNoCajaIncluidasPorLegado,1);
 assert.equal(r.importeObligacionesNoCajaMinor,500000);
 assert.equal(r.diferenciaExplicadaPorNoCajaMinor,500000);
 assert.equal(r.diferenciaResidualMinor,0);
});
test("diagnóstico usa BigInt y rechaza sumas que exceden enteros seguros",()=>{
 const a={...gasto,montoMinor:Number.MAX_SAFE_INTEGER};
 const b={...pago,montoMinor:1};
 const verificado={fuente:"EVENTOS_COMPENSATORIOS_VERIFICADOS",
  ingresosMinor:0,gastosMinor:0,pagosDeudaMinor:0,flujoNetoMinor:0};
 assert.throws(()=>compararProyeccionesPersonal({
  usuarioId:uid,movimientos:[a,b],desde,hasta,verificado
 }),/INTEGRIDAD_DIAGNOSTICO/);
});
test("ruta de diagnóstico solo lectura está detrás de auth y usa el propietario JWT",()=>{
 const s=fs.readFileSync(path.join(__dirname,
  "../../modules/finanzas-personales/routes.js"),"utf8");
 const auth=s.indexOf("router.use(auth,entitlement);");
 const ep=s.indexOf('router.get("/v81/diagnostico-proyecciones"');
 assert.ok(auth>=0&&ep>auth);
 assert.ok(s.slice(ep,ep+650).includes("req.personalAuth.userId"));
 assert.ok(s.slice(ep,ep+650).includes("diagnostico:true"));
});

test("no muestra un diagnóstico si el flujo verificado llega inconsistente",()=>{
 const valido={fuente:"EVENTOS_COMPENSATORIOS_VERIFICADOS",
  ingresosMinor:1000,gastosMinor:200,pagosDeudaMinor:100,flujoNetoMinor:700};
 for(const cambio of [
  {flujoNetoMinor:701},
  {gastosMinor:0.1},
  {pagosDeudaMinor:Number.MAX_SAFE_INTEGER+1},
  {ingresosMinor:undefined}
 ]){
  assert.throws(()=>compararProyeccionesPersonal({
   usuarioId:uid,movimientos:[gasto],desde,hasta,
   verificado:{...valido,...cambio}
  }),/INTEGRIDAD_DIAGNOSTICO/);
 }
});
test("diagnóstico cuenta obligaciones pendientes solo dentro de la ventana",()=>{
 const fuera={...compromiso,_id:"507f1f77bcf86cd799439097",
  fecha:"2026-12-20T12:00:00Z",montoMinor:999999};
 const anulada={...compromiso,_id:"507f1f77bcf86cd799439098",
  estado:"ANULADA",montoMinor:900000};
 const r=revisar([gasto,compromiso,fuera,anulada]);
 assert.equal(r.obligacionesNoCajaIncluidasPorLegado,1);
 assert.equal(r.importeObligacionesNoCajaMinor,500000);
 assert.equal(r.verificado.flujoNetoMinor,-25000);
});

test("diferencias opuestas no se disfrazan como reconciliación completa",()=>{
 const noCaja={...gasto,_id:"507f1f77bcf86cd799439090",
  impactoCaja:false,montoMinor:3000};
 const e=eventoCompensatorio({
  original:{usuarioId:uid,movimientoId:gasto._id,tipo:"GASTO",
   montoMinor:25000,concepto:"Rappi",categoria:"Comida"},
  tipo:"CORRECCION",cambios:{montoMinor:28000},
  idempotencyKey:"cancelacion_aparente",prevHash:"0".repeat(64),
  secuencia:1,fechaISO:"2026-10-20T16:00:00.000Z"
 });
 const r=revisar([gasto,noCaja],[e]);
 assert.equal(r.totalesCoinciden,true);
 assert.equal(r.coincide,false);
 assert.equal(r.diferenciaVerificadoMenosLegado.flujoNetoMinor,0);
 assert.equal(r.diferenciaExplicadaPorNoCajaMinor,3000);
 assert.equal(r.diferenciaResidualMinor,-3000);
});
test("una operación de ingreso sin caja aporta diferencia con signo correcto",()=>{
 const ingreso={...gasto,_id:"507f1f77bcf86cd799439091",
  impactoCaja:false,tipo:"INGRESO",montoMinor:12500};
 const r=revisar([ingreso]);
 assert.equal(r.diferenciaVerificadoMenosLegado.flujoNetoMinor,-12500);
 assert.equal(r.diferenciaExplicadaPorNoCajaMinor,-12500);
 assert.equal(r.diferenciaResidualMinor,0);
});

test("flujoPeriodo actual excluye no-caja; comparador conserva base histórica identificable",()=>{
 const fuente=fs.readFileSync(path.join(__dirname,
  "../../modules/finanzas-personales/services/flujoCajaPersonal.service.js"),"utf8");
 const inicio=fuente.indexOf("async function flujoPeriodo(");
 const fin=fuente.indexOf("async function corregirTransaccion",inicio);
 const bloque=fuente.slice(inicio,fin);
 assert.ok(inicio>=0&&fin>inicio);
 assert.ok(bloque.includes("impactoCaja:{$ne:false}"));
 const diagnostico=revisar([compromiso,pago]);
 assert.equal(diagnostico.fuenteLegado,"BASE_HISTORICA_PRE_FILTRO_IMPACTO_CAJA");
 assert.equal(diagnostico.legado.gastosMinor,700000);
 assert.equal(diagnostico.verificado.gastosMinor,200000);
});
