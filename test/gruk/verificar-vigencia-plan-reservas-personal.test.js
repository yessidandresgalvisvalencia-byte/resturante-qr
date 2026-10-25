"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {planearReparacionReservas}=require(
 "../../modules/finanzas-personales/services/planReparacionReservasPersonal.service");
const {verificarVigenciaPlanReservas}=require(
 "../../modules/finanzas-personales/services/verificarVigenciaPlanReservasPersonal.service");
const usuarioId="507f1f77bcf86cd799439011",origenId="507f1f77bcf86cd799439012";
const periodoInicio="2026-11-15T05:00:00.000Z";
function dictamen(observado="199999"){
 const anomalías=observado===null?[]:[{
  codigo:"RESERVA_DESCUADRADA",periodoInicio,
  esperadoMinor:"200000",observadoMinor:observado
 }];
 return {estado:anomalías.length?"REQUIERE_CONCILIACION":"COHERENTE",
  anomalías,soloLectura:true,aptoParaDisponibleHoy:false};
}
function probar(anterior,actual){
 const huellaEsperada=planearReparacionReservas({usuarioId,origenId,
  auditoria:anterior}).huellaDiagnostico;
 return verificarVigenciaPlanReservas({usuarioId,origenId,
  huellaEsperada,auditoriaActual:actual});
}
test("acepta exclusivamente mismo diagnóstico y jamás autoriza escritura",()=>{
 const r=probar(dictamen(),dictamen());
 assert.equal(r.vigente,true);
 assert.equal(r.cambiosSugeridos,1);
 assert.equal(r.autorizaEscritura,false);
 assert.equal(r.requiereControlConcurrenteDeEscritura,true);
 assert.equal(r.aptoParaDisponibleHoy,false);
});
test("rechaza plan obsoleto por cambio de un peso",()=>{
 assert.throws(()=>probar(dictamen("199999"),dictamen("199998")),
  e=>e.statusCode===409&&/desactualizado/.test(e.message));
});
test("rechaza plan si entre lecturas se resolvió la diferencia",()=>{
 assert.throws(()=>probar(dictamen(),dictamen(null)),
  e=>e.statusCode===409);
});
test("no autoriza reparaciones innecesarias con auditoría coherente",()=>{
 assert.throws(()=>probar(dictamen(null),dictamen(null)),
  e=>e.statusCode===409&&/no existen diferencias/.test(e.message));
});
test("rechaza huellas fabricadas o identidades cambiadas",()=>{
 for(const h of ["", "0.1", "A".repeat(64),"a".repeat(63)])
  assert.throws(()=>verificarVigenciaPlanReservas({usuarioId,origenId,
   huellaEsperada:h,auditoriaActual:dictamen()}),e=>e.statusCode===400);
 const h=planearReparacionReservas({usuarioId,origenId,
  auditoria:dictamen()}).huellaDiagnostico;
 assert.throws(()=>verificarVigenciaPlanReservas({
  usuarioId,origenId:"507f1f77bcf86cd799439099",
  huellaEsperada:h,auditoriaActual:dictamen()}),e=>e.statusCode===409);
});
test("diagnósticos que incluyen revisión manual quedan bloqueados",()=>{
 const a={estado:"REQUIERE_CONCILIACION",soloLectura:true,
  aptoParaDisponibleHoy:false,anomalías:[{
   codigo:"PERIODO_INCORRECTO",periodoInicio
  }]};
 assert.throws(()=>probar(a,a),e=>e.statusCode===409&&/revisión manual/.test(e.message));
});
