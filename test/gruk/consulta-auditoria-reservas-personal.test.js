"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {crearConsultaAuditoriaReservas,MAX}=require(
 "../../modules/finanzas-personales/services/consultaAuditoriaReservasPersonal.service");
const uid="507f1f77bcf86cd799439011",mid="507f1f77bcf86cd799439012";
const origen={_id:mid,usuarioId:uid,tipo:"GASTO",impactoCaja:false,
 cuentaId:null,cuenta:"SIN_CAJA",estado:"ACTIVA",recurrente:true,
 frecuencia:"MENSUAL",montoMinor:500000,
 fecha:new Date("2026-11-15T12:00:00Z")};
const pago={_id:"507f1f77bcf86cd799439013",usuarioId:uid,
 recurrenteOrigenId:mid,tipo:"GASTO",impactoCaja:true,estado:"ACTIVA",
 montoMinor:200000,fecha:new Date("2026-11-16T12:00:00Z")};
const reserva={usuarioId:uid,origenId:mid,montoMinor:500000,
 importeCuotaMinor:500000,reservadoMinor:200000,
 periodoInicio:new Date("2026-11-15T05:00:00Z"),
 periodoFin:new Date("2026-12-15T05:00:00Z")};
function dobles({pagos=[pago],reservas=[reserva],eventos=[],
 cursor={secuencia:0,hashActual:"0".repeat(64)},cancelacion=null}={}){
 const session={async withTransaction(fn,opts){
  assert.equal(opts.readConcern.level,"snapshot");await fn();
 },async endSession(){}};
 function query(value){return {sort(){return this;},limit(n){
  assert.equal(n,MAX+1);return this;},
  session(s){assert.equal(s,session);return{lean:async()=>value};}};}
 return crearConsultaAuditoriaReservas({
  MovimientoModelo:{findOne(){return query(origen);},find(){return query(pagos);}},
  ReservaModelo:{find(){return query(reservas);}},
  EventoModelo:{find(){return query(eventos);}},
  CursorModelo:{findById(){return query(cursor);}},
  CancelacionModelo:{findOne(){return query(cancelacion);}},
  nuevaSesion:async()=>session
 });
}
test("lector único devuelve auditoría coherente sin tocar caja",async()=>{
 const r=await dobles()(uid,mid);
 assert.equal(r.estado,"COHERENTE");
 assert.equal(r.fuenteDatos,"SNAPSHOT_MONGO_AUDITORIA");
 assert.equal(r.aptoParaDisponibleHoy,false);
 assert.equal(r.planReparacion.estado,"SIN_DIFERENCIAS");
 assert.equal(r.planReparacion.autorizaEscritura,false);
});
test("detecta reserva con diferencia de un peso",async()=>{
 const r=await dobles({reservas:[{...reserva,reservadoMinor:199999}]})(uid,mid);
 assert.equal(r.estado,"REQUIERE_CONCILIACION");
 assert.ok(r.anomalías.some(a=>a.codigo==="RESERVA_DESCUADRADA"));
 assert.equal(r.planReparacion.acciones[0].deltaMinor,"1");
 assert.equal(r.planReparacion.requiereReauditoriaAtomica,true);
});
test("bloquea obligación cancelada, volumen truncado y cursor corrupto",async()=>{
 for(const props of [
  {cancelacion:{_id:"507f1f77bcf86cd799439014"}},
  {pagos:Array(MAX+1).fill(pago)},
  {cursor:{secuencia:5,hashActual:"0".repeat(64)}}
 ])await assert.rejects(()=>dobles(props)(uid,mid),
  e=>e.statusCode===409||e.statusCode===503);
});
test("rechaza identidad inválida antes de consultar",async()=>{
 await assert.rejects(()=>dobles()("invalid",mid),e=>e.statusCode===400);
});

test("snapshot rechaza huella previa cuando la reserva cambió un peso",async()=>{
 const antes=await dobles({reservas:[{...reserva,reservadoMinor:199999}]})(
  uid,mid);
 const huellaEsperada=antes.planReparacion.huellaDiagnostico;
 const vigente=await dobles({reservas:[{...reserva,reservadoMinor:199999}]})(
  uid,mid,{huellaEsperada});
 assert.equal(vigente.vigenciaPlan.vigente,true);
 assert.equal(vigente.vigenciaPlan.autorizaEscritura,false);
 await assert.rejects(()=>dobles({
  reservas:[{...reserva,reservadoMinor:199998}]
 })(uid,mid,{huellaEsperada}),e=>e.statusCode===409);
 await assert.rejects(()=>dobles()(uid,mid,{huellaEsperada}),
  e=>e.statusCode===409);
});
