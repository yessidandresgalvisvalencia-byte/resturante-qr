"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {conciliarCuotasConCadenaVerificada}=require(
 "../../modules/finanzas-personales/services/conciliarCuotasConCadenaPersonal.service");
const {eventoCompensatorio}=require(
 "../../modules/finanzas-personales/services/eventoCompensatorioPersonal.service");
const usuarioId="507f1f77bcf86cd799439011";
const origen={_id:"507f1f77bcf86cd799439012",usuarioId,tipo:"GASTO",
 impactoCaja:false,cuentaId:null,cuenta:"SIN_CAJA",estado:"ACTIVA",
 montoMinor:500000,fecha:new Date("2026-11-15T12:00:00Z"),
 recurrente:true,frecuencia:"MENSUAL"};
const pago={_id:"507f1f77bcf86cd799439020",usuarioId,
 recurrenteOrigenId:origen._id,tipo:"GASTO",impactoCaja:true,
 estado:"ACTIVA",montoMinor:200000,concepto:"Abono",
 categoria:"Vivienda",fecha:new Date("2026-11-16T12:00:00Z")};
const genesis="0".repeat(64);
const rango={desde:"2026-11-01T05:00:00Z",hasta:"2027-01-01T05:00:00Z"};
test("cadena génesis permite conciliar abono sin habilitar Disponible Hoy",()=>{
 const r=conciliarCuotasConCadenaVerificada({usuarioId,origen,pagos:[pago],
  eventos:[],cursor:{secuencia:0,hashActual:genesis},...rango});
 assert.equal(r.totalBrutoMinor,"1000000");
 assert.equal(r.totalPagadoMinor,"200000");
 assert.equal(r.totalPendienteMinor,"800000");
 assert.equal(r.aptoParaDisponibleHoy,false);
 assert.equal(r.fuenteCompensacion,
  "CADENA_VERIFICADA_SIN_EVENTOS_SOBRE_ABONOS");
});
test("corrección monetaria impide afirmar saldos pendientes sin ajustar reserva",()=>{
 const e=eventoCompensatorio({original:{usuarioId,
  movimientoId:pago._id,tipo:"GASTO",montoMinor:200000,
  concepto:"Abono",categoria:"Vivienda"},
  tipo:"CORRECCION",cambios:{montoMinor:100000},
  secuencia:1,prevHash:genesis,idempotencyKey:"fixcuota",
  fechaISO:"2026-10-24T20:00:00.000Z"});
 assert.throws(()=>conciliarCuotasConCadenaVerificada({
  usuarioId,origen,pagos:[pago],eventos:[e],
  cursor:{secuencia:1,hashActual:e.hashActual},...rango
 }),err=>err.statusCode===409);
});
