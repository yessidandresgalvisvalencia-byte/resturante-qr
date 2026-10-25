"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {auditarReservasRecurrencia}=require(
 "../../modules/finanzas-personales/services/auditarReservasRecurrenciaPersonal.service");
const usuarioId="507f1f77bcf86cd799439011";
const id="507f1f77bcf86cd799439012";
const origen={_id:id,usuarioId,estado:"ACTIVA",tipo:"GASTO",
 impactoCaja:false,cuentaId:null,cuenta:"SIN_CAJA",montoMinor:500000,
 recurrente:true,frecuencia:"MENSUAL",fecha:new Date("2026-11-15T12:00:00Z")};
const pago={_id:"507f1f77bcf86cd799439013",usuarioId,
 recurrenteOrigenId:id,tipo:"GASTO",estado:"ACTIVA",impactoCaja:true,
 montoMinor:200000,fecha:new Date("2026-11-16T12:00:00Z")};
const reserva={usuarioId,origenId:id,importeCuotaMinor:500000,
 reservadoMinor:200000,periodoInicio:new Date("2026-11-15T05:00:00Z"),
 periodoFin:new Date("2026-12-15T05:00:00Z")};
const datos={usuarioId,origen,pagos:[pago],reservas:[reserva],eventos:[],
 cursor:{secuencia:0,hashActual:"0".repeat(64)}};
test("reserva y abono coherentes producen dictamen sin autorizar gasto",()=>{
 const r=auditarReservasRecurrencia(datos);
 assert.equal(r.estado,"COHERENTE");
 assert.deepEqual(r.anomalías,[]);
 assert.equal(r.aptoParaDisponibleHoy,false);
});
test("una diferencia de un peso se detecta sin actualizar el saldo",()=>{
 const r=auditarReservasRecurrencia({...datos,
  reservas:[{...reserva,reservadoMinor:199999}]});
 assert.equal(r.estado,"REQUIERE_CONCILIACION");
 assert.deepEqual(r.anomalías.map(x=>x.codigo),["RESERVA_DESCUADRADA"]);
 assert.equal(r.anomalías[0].esperadoMinor,"200000");
 assert.equal(r.anomalías[0].observadoMinor,"199999");
 assert.equal(reserva.reservadoMinor,200000);
});
test("detecta reserva ausente, sobrante y período alterado",()=>{
 const escenarios=[
  [[], "FALTA_RESERVA"],
  [[{...reserva,periodoFin:new Date("2026-12-16T05:00:00Z")}],
   "PERIODO_INCORRECTO"],
  [[{...reserva,reservadoMinor:100000}],
   "RESERVA_DESCUADRADA"]
 ];
 for(const [reservas,codigo] of escenarios){
  const r=auditarReservasRecurrencia({...datos,reservas});
  assert.ok(r.anomalías.some(x=>x.codigo===codigo));
 }
});
test("abono legado ANULADA no puede seguir sumando a reserva",()=>{
 const r=auditarReservasRecurrencia({...datos,
  pagos:[{...pago,estado:"ANULADA"}]});
 assert.equal(r.abonosAnulados,1);
 assert.ok(r.anomalías.some(x=>x.codigo==="RESERVA_DESCUADRADA"));
});
test("rechaza historial inválido de forma cerrada",()=>{
 for(const cambio of [
  {pagos:[pago,pago]},
  {pagos:[{...pago,usuarioId:"507f1f77bcf86cd799439099"}]},
  {reservas:[{...reserva,periodoInicio:"fecha invalida"}]},
  {reservas:[reserva,reserva]},
  {cursor:{secuencia:2,hashActual:"0".repeat(64)}}
 ])assert.throws(()=>auditarReservasRecurrencia({...datos,...cambio}),
  e=>e.statusCode===409);
});
