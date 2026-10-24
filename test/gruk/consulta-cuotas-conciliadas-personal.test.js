"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {crearConsultaCuotasConciliadas,validarReservas}=require(
 "../../modules/finanzas-personales/services/consultaCuotasConciliadasPersonal.service");
const usuarioId="507f1f77bcf86cd799439011",id="507f1f77bcf86cd799439012";
const original={_id:id,usuarioId,tipo:"GASTO",estado:"ACTIVA",impactoCaja:false,
 cuentaId:null,cuenta:"SIN_CAJA",montoMinor:500000,recurrente:true,
 frecuencia:"MENSUAL",fecha:new Date("2026-11-15T12:00:00Z")};
const pago={_id:"507f1f77bcf86cd799439013",usuarioId,
 recurrenteOrigenId:id,tipo:"GASTO",estado:"ACTIVA",impactoCaja:true,
 montoMinor:200000,fecha:new Date("2026-11-16T12:00:00Z")};
const reserva={usuarioId,origenId:id,
 periodoInicio:new Date("2026-11-15T05:00:00Z"),
 periodoFin:new Date("2026-12-15T05:00:00Z"),
 importeCuotaMinor:500000,reservadoMinor:200000};
const rango={desde:"2026-11-01T05:00:00Z",hasta:"2027-01-01T05:00:00Z"};
function crearLectura({pagos=[pago],reservas=[reserva],eventos=[],
 cursor=null,cancelacion=null}={}){
 const session={async withTransaction(fn,opt){
  assert.equal(opt.readConcern.level,"snapshot");await fn();
 },async endSession(){}};
 function query(value){return {sort(){return this;},limit(){return this;},
  session(s){assert.equal(s,session);return {lean:async()=>value};}};}
 const modelos={
  MovimientoModelo:{findOne(){return query(original);},
   find(){return query(pagos);}},
  EventoModelo:{find(){return query(eventos);}},
  CursorModelo:{findById(){return query(cursor);}},
  ReservaModelo:{find(){return query(reservas);}},
  CancelacionModelo:{findOne(){return query(cancelacion);}},
  nuevaSesion:async()=>session
 };
 return crearConsultaCuotasConciliadas(modelos);
}
test("un único snapshot verifica reserva y retorna pendiente seguro solo para lectura",async()=>{
 const r=await crearLectura()(usuarioId,id,rango);
 assert.equal(r.totalBrutoMinor,"1000000");
 assert.equal(r.totalPagadoMinor,"200000");
 assert.equal(r.totalPendienteMinor,"800000");
 assert.equal(r.aptoParaDisponibleHoy,false);
 assert.equal(r.fuenteDatos,"SNAPSHOT_MONGO_COMPLETO_CON_RESERVAS");
});
test("rechaza reservas incompletas, repetidas, alteradas y sin abono",async()=>{
 for(const escenarios of [
  {reservas:[]},
  {reservas:[{...reserva,reservadoMinor:150000}]},
  {reservas:[reserva,reserva]},
  {reservas:[{...reserva,usuarioId:"507f1f77bcf86cd799439099"}]},
  {reservas:[{...reserva,periodoFin:new Date("2026-12-14T05:00:00Z")}]},
  {pagos:[],reservas:[reserva]}
 ])await assert.rejects(
  ()=>crearLectura(escenarios)(usuarioId,id,rango),e=>e.statusCode===409);
});
test("obligación cancelada impide calcular cuota a partir de historial viejo",async()=>{
 await assert.rejects(()=>crearLectura({cancelacion:{_id:"evento"}})(
  usuarioId,id,rango),e=>e.statusCode===409);
});
test("repite importes seguros, sin redondeos",()=>{
 const a=validarReservas({usuarioId,origen:original,pagos:[pago],reservas:[reserva]});
 assert.equal(a,true);
});
