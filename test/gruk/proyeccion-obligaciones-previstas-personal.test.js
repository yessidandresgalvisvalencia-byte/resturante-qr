"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {proyectarObligaciones,crearConsultaObligaciones}=require(
 "../../modules/finanzas-personales/services/proyeccionObligacionesPrevistasPersonal.service");
const usuarioId="507f1f77bcf86cd799439011",id="507f1f77bcf86cd799439012";
const m={_id:id,usuarioId,tipo:"GASTO",impactoCaja:false,cuentaId:null,
 cuenta:"SIN_CAJA",estado:"ACTIVA",montoMinor:500000,
 concepto:"Arriendo",categoria:"Vivienda",fecha:new Date("2026-11-15T12:00:00Z"),
 frecuencia:"MENSUAL",recurrente:true};
const e={usuarioId,obligacionId:id,tipo:"CANCELACION_OBLIGACION_PREVISTA",
 snapshot:{montoMinor:m.montoMinor,concepto:m.concepto,categoria:m.categoria,
 fecha:m.fecha,frecuencia:m.frecuencia,recurrente:m.recurrente}};
const rango={desde:"2026-11-01T00:00:00Z",hasta:"2026-12-01T00:00:00Z"};
test("obligación sin evento suma en pendiente y no en caja",()=>{
 const r=proyectarObligaciones({usuarioId,movimientos:[m],cancelaciones:[],...rango});
 assert.equal(r.pendienteMinor,"500000");
 assert.equal(r.canceladoMinor,"0");
 assert.equal(r.compromisos[0].estado,"PENDIENTE");
 assert.equal(r.compromisos[0].impactoCaja,false);
});
test("cancelación append-only mueve pendiente a cancelado sin modificar original",()=>{
 const antes=structuredClone(m);
 const r=proyectarObligaciones({usuarioId,movimientos:[m],cancelaciones:[e],...rango});
 assert.equal(r.pendienteMinor,"0");assert.equal(r.canceladoMinor,"500000");
 assert.equal(r.compromisos[0].estado,"CANCELADA");
 assert.deepEqual(m,antes);
});
test("exige integridad de evento e identidad antes de reportar comprometido",()=>{
 for(const evento of [
  {...e,usuarioId:"507f1f77bcf86cd799439099"},
  {...e,obligacionId:"507f1f77bcf86cd799439099"},
  {...e,snapshot:{...e.snapshot,montoMinor:1}},
  {...e,snapshot:{...e.snapshot,concepto:"Otro"}},
  {...e,snapshot:{...e.snapshot,fecha:new Date("2026-12-15T12:00:00Z")}}
 ])assert.throws(()=>proyectarObligaciones({usuarioId,movimientos:[m],
   cancelaciones:[evento],...rango}),err=>err.statusCode===409);
 assert.throws(()=>proyectarObligaciones({usuarioId,movimientos:[m],
  cancelaciones:[e,e],...rango}),err=>err.statusCode===409);
});
test("totales grandes se acumulan con BigInt, sin float ni desbordamiento",()=>{
 const a={...m,montoMinor:Number.MAX_SAFE_INTEGER};
 const b={...a,_id:"507f1f77bcf86cd799439013"};
 const r=proyectarObligaciones({usuarioId,movimientos:[a,b],
  cancelaciones:[],...rango});
 assert.equal(r.pendienteMinor,
  (2n*BigInt(Number.MAX_SAFE_INTEGER)).toString());
});
test("lectura usa un único snapshot para originales y eventos",async()=>{
 const session={async withTransaction(fn,o){
  assert.equal(o.readConcern.level,"snapshot");await fn();
 },async endSession(){}};
 const Mov={find(){return {limit(n){assert.ok(n>10000);return{
  session(s){assert.equal(s,session);return{lean:async()=>[m]};}
 };}};}};
 const Can={find(){return {limit(n){return{
  session(s){assert.equal(s,session);return{lean:async()=>[e]};}
 };}};}};
 const consultar=crearConsultaObligaciones({MovimientoModelo:Mov,
  CancelacionModelo:Can,nuevaSesion:async()=>session});
 const r=await consultar(usuarioId,rango);
 assert.equal(r.canceladoMinor,"500000");
});
