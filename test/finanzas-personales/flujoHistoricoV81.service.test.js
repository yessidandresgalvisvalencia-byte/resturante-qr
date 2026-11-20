"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const mongoose=require("mongoose");
const consulta=require("../../modules/finanzas-personales/services/consultaCompensadaPersonal.service");
const {consultarFlujoHistoricoV81}=require("../../modules/finanzas-personales/services/flujoHistoricoV81.service");
test("V81 lee solo las transacciones del usuario y distingue flujo de saldo",async t=>{
 const original=consulta.consultarPeriodo;const id="507f1f77bcf86cd799439011";
 let query;
 consulta.consultarPeriodo=async(filtro)=>{query=filtro;return [
  {tipo:"INGRESO",montoMinor:1000,impactoCaja:true},
  {tipo:"GASTO",montoMinor:200,impactoCaja:true,medioPago:"DEBITO"},
  {tipo:"GASTO",montoMinor:300,impactoCaja:true,medioPago:"CREDITO"},
  {tipo:"PAGO_DEUDA",montoMinor:150,impactoCaja:true}
 ];};
 t.after(()=>{consulta.consultarPeriodo=original;});
 const data=await consultarFlujoHistoricoV81(id);
 assert.equal(String(query.usuarioId),id);assert.equal(query.desde,"0001-01-01T00:00:00.000Z");assert.equal(query.incluirAnuladas,undefined);
 assert.equal(data.flujoCentavos,"80000");assert.equal(data.excluidos,2);
 assert.equal(data.conciliableConSaldoV81,false);
});
test("V81 rechaza montos históricos no seguros",async t=>{
 const original=consulta.consultarPeriodo;t.after(()=>{consulta.consultarPeriodo=original;});
 consulta.consultarPeriodo=async()=>[{tipo:"GASTO",montoMinor:0.1}];
 await assert.rejects(consultarFlujoHistoricoV81("507f1f77bcf86cd799439011"),/inseguro/);
 await assert.rejects(consultarFlujoHistoricoV81("no-id"),TypeError);
});
