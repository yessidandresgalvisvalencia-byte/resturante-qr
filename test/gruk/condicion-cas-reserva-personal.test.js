"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {prepararCondicionCasReserva}=require(
 "../../modules/finanzas-personales/services/condicionCasReservaPersonal.service");
const usuarioId="507f1f77bcf86cd799439011";
const origenId="507f1f77bcf86cd799439012";
const reserva={_id:"507f1f77bcf86cd799439013",usuarioId,origenId,
 periodoInicio:new Date("2026-11-15T05:00:00Z"),
 periodoFin:new Date("2026-12-15T05:00:00Z"),
 importeCuotaMinor:500000,reservadoMinor:199999};
const parametros={usuarioId,origenId,reserva,
 importeEsperadoMinor:199999,importeNuevoMinor:200000};
test("CAS incluye importe previo, identidad, período y cuota íntegra",()=>{
 const plan=prepararCondicionCasReserva(parametros);
 assert.equal(String(plan.filtro._id),String(reserva._id));
 assert.equal(String(plan.filtro.usuarioId),usuarioId);
 assert.equal(String(plan.filtro.origenId),origenId);
 assert.equal(plan.filtro.reservadoMinor,199999);
 assert.equal(plan.filtro.importeCuotaMinor,500000);
 assert.equal(plan.filtro.periodoInicio.toISOString(),"2026-11-15T05:00:00.000Z");
 assert.equal(plan.deltaMinor,"1");
 assert.equal(plan.updatePermitidoSoloConTransaccion,false);
 assert.equal(plan.requiereResultadoMatchedExactlyOne,true);
 assert.equal(plan.requiereEventoAppendOnly,true);
 assert.equal(reserva.reservadoMinor,199999);
});
test("rechaza cambio concurrente de un peso y propuestas superiores a cuota",()=>{
 for(const cambio of [
  {importeEsperadoMinor:200000},
  {importeNuevoMinor:500001},
  {importeNuevoMinor:-1},
  {importeNuevoMinor:0.5}
 ])assert.throws(()=>prepararCondicionCasReserva({...parametros,...cambio}),
  e=>e.statusCode===409||e.statusCode===400);
});
test("bloquea reservas de otro usuario, origen o período inválido",()=>{
 for(const cambio of [
  {usuarioId:"507f1f77bcf86cd799439099"},
  {origenId:"507f1f77bcf86cd799439099"},
  {reserva:{...reserva,periodoFin:new Date("2026-11-15T05:00:00Z")}},
  {reserva:{...reserva,periodoInicio:"2026-11-15T05:00:00Z"}}
 ])assert.throws(()=>prepararCondicionCasReserva({...parametros,...cambio}),
  e=>e.statusCode===409||e.statusCode===400);
});
test("soporta cambios negativos y cantidades seguras sin float",()=>{
 const plan=prepararCondicionCasReserva({...parametros,
  importeNuevoMinor:199998});
 assert.equal(plan.deltaMinor,"-1");
 const max=Number.MAX_SAFE_INTEGER;
 const borde=prepararCondicionCasReserva({...parametros,
  reserva:{...reserva,importeCuotaMinor:max,reservadoMinor:max-1},
  importeEsperadoMinor:max-1,importeNuevoMinor:max});
 assert.equal(borde.deltaMinor,"1");
});
