"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {planificarCompensacionCaja}=require("../../modules/finanzas-personales/services/planificarCompensacionCajaPersonal.service");
const {eventoCompensatorio}=require("../../modules/finanzas-personales/services/eventoCompensatorioPersonal.service");
const usuarioId="507f1f77bcf86cd799439011",movimientoId="507f1f77bcf86cd799439012";
const original={usuarioId,movimientoId,tipo:"GASTO",montoMinor:25000,concepto:"Rappi",categoria:"Alimentacion"};
const hash="0".repeat(64),fechaISO="2026-10-20T15:00:00.000Z";
const base={usuarioId,originales:[original],eventos:[],cursor:{_id:usuarioId,secuencia:0,hashActual:hash},
 movimientoId,tipo:"CORRECCION",cambios:{montoMinor:22000},idempotencyKey:"c1",fechaISO};
function calcular(saldoMinor,otros={}){return planificarCompensacionCaja({saldoMinor,...base,...otros});}
test("corrección de gasto reduce consumo y abona exactamente diferencia a caja",()=>{
 const p=calcular(100000);
 assert.equal(p.deltaCajaMinor,"3000");
 assert.equal(p.saldoPosteriorMinor,"103000");
 assert.equal(p.evento.deltaCajaMinor,p.deltaCajaMinor);
 assert.equal(original.montoMinor,25000);
});
test("anular gasto revierte exactamente el importe vigente",()=>{
 const primero=calcular(100000).evento;
 const vigente={...base,cursor:{_id:usuarioId,secuencia:1,hashActual:primero.hashActual},
  eventos:[primero],tipo:"ANULACION",cambios:{},idempotencyKey:"anular_1"};
 const p=calcular(103000,vigente);
 assert.equal(p.deltaCajaMinor,"22000");
 assert.equal(p.saldoPosteriorMinor,"125000");
});
test("anular ingreso exige saldo suficiente, salvo política explícita",()=>{
 const ingreso={...original,tipo:"INGRESO",montoMinor:50000};
 const params={originales:[ingreso],tipo:"ANULACION",cambios:{},idempotencyKey:"a1"};
 assert.throws(()=>calcular(10000,params),/saldo insuficiente/);
 const p=calcular(10000,{...params,permitirSaldoNegativo:true});
 assert.equal(p.deltaCajaMinor,"-50000");
 assert.equal(p.saldoPosteriorMinor,"-40000");
});
test("bloquea desbordamiento de saldo aunque el delta sea entero seguro",()=>{
 assert.throws(()=>calcular(Number.MAX_SAFE_INTEGER),/desbordamiento monetario/);
 assert.throws(()=>calcular(Number.MAX_SAFE_INTEGER+1),/entero seguro/);
 assert.throws(()=>calcular(1.5),/entero seguro/);
});
test("rechaza cambio de tipo si consume más caja que la disponible",()=>{
 assert.throws(()=>calcular(10000,{cambios:{tipo:"GASTO",montoMinor:22000},saldoMinor:10000,
  originales:[{...original,tipo:"INGRESO"}],tipo:"CORRECCION"}),/COMPENSACION_NO_APLICABLE|INTEGRIDAD_LEDGER/);
});
test("repetir idempotencia o anulación no genera plan contable",()=>{
 const p=calcular(100000);
 const cursor={_id:usuarioId,secuencia:1,hashActual:p.evento.hashActual};
 assert.throws(()=>calcular(103000,{eventos:[p.evento],cursor}),/INTEGRIDAD_LEDGER/);
 const anulacion=eventoCompensatorio({original,tipo:"ANULACION",cambios:{},idempotencyKey:"a1",prevHash:hash,secuencia:1,fechaISO});
 assert.throws(()=>calcular(125000,{eventos:[anulacion],cursor:{...cursor,hashActual:anulacion.hashActual},
  tipo:"ANULACION",cambios:{},idempotencyKey:"a2"}),/INTEGRIDAD_LEDGER/);
});
