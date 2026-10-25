"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {construirEventoReconciliacionReserva,verificarEventoReconciliacionReserva}=
 require("../../modules/finanzas-personales/services/eventoReconciliacionReservaPersonal.service");
const args={
 usuarioId:"507f1f77bcf86cd799439011",
 origenId:"507f1f77bcf86cd799439012",
 reservaId:"507f1f77bcf86cd799439013",
 periodoInicio:new Date("2026-11-15T05:00:00.000Z"),
 huellaEstadoPrevio:"a".repeat(64),huellaDiagnostico:"b".repeat(64),
 idempotencyHash:"c".repeat(64),importeAnteriorMinor:"199999",
 importeNuevoMinor:"200000",fecha:new Date("2026-10-25T15:00:00.000Z")
};
test("reconciliación de un peso produce evidencia determinística sin escribir",()=>{
 const a=construirEventoReconciliacionReserva(args),
  b=construirEventoReconciliacionReserva(args);
 assert.equal(a.deltaMinor,"1");
 assert.equal(a.hashEvento,b.hashEvento);
 assert.equal(a.tipo,"RECONCILIACION_RESERVA");
 assert.equal(a.hashEvento.length,64);
 assert.equal(verificarEventoReconciliacionReserva(a),true);
 assert.equal(args.importeAnteriorMinor,"199999");
});
test("rechaza adulteración de datos, hashes y campos no autorizados",()=>{
 const e=construirEventoReconciliacionReserva(args);
 for(const tampered of [
  {...e,importeNuevoMinor:"300000"},
  {...e,deltaMinor:"9000"},
  {...e,hashEvento:"0".repeat(64)},
  {...e,otroDato:"forjado"},
  {...e,usuarioId:"507f1f77bcf86cd799439099"}
 ])assert.equal(verificarEventoReconciliacionReserva(tampered),false);
});
test("permite delta negativo exacto y rechaza propuesta sin efecto",()=>{
 const e=construirEventoReconciliacionReserva({...args,
  importeAnteriorMinor:"200001",importeNuevoMinor:"200000"});
 assert.equal(e.deltaMinor,"-1");
 assert.throws(()=>construirEventoReconciliacionReserva({
  ...args,importeAnteriorMinor:"200000"
 }),err=>err.statusCode===409);
});
test("nunca permite float, importes negativos ni fuera del rango seguro",()=>{
 for(const monto of ["0.1","-1","01","9007199254740992","NaN"]){
  assert.throws(()=>construirEventoReconciliacionReserva({
   ...args,importeNuevoMinor:monto
  }),err=>err.statusCode===400);
 }
});
test("identificador, período, idempotencia y fecha son obligatorios",()=>{
 for(const mod of [
  {usuarioId:"admin"},
  {reservaId:"otro"},
  {idempotencyHash:"mal"},
  {periodoInicio:new Date("inválido")},
  {fecha:"2026-10-25"}
 ])assert.throws(()=>construirEventoReconciliacionReserva({
  ...args,...mod
 }),err=>err.statusCode===400);
});
