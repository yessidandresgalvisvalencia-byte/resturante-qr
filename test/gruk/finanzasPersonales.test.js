"use strict";
const test=require("node:test");const assert=require("node:assert/strict");const service=require("../../modules/finanzas-personales/services/finanzasPersonales.service");
test("simula crédito sin interés",()=>{const r=service.simularCredito({capital:1200000,tasaMensualPct:0,meses:12});assert.equal(r.cuotaMensual,100000);assert.equal(r.costoTotal,1200000);assert.equal(r.interesesEstimados,0);});
test("simula crédito con interés y TEA",()=>{const r=service.simularCredito({capital:10000000,tasaMensualPct:1.5,meses:24});assert.ok(r.cuotaMensual>0);assert.ok(r.costoTotal>10000000);assert.ok(r.tasaEfectivaAnualPct>18);});
const interprete=require("../../modules/finanzas-personales/services/interpreteFinanciero.service");
test("estructura obligacion recurrente con abono previo",()=>{const r=interprete.deudaEstructurada("Tengo una deuda de 7 millones, cada 15 de cada mes me toca pagar un millon y ya habia abonado 2 millones quinientos");assert.equal(r.tipo,"DEUDA_POR_PAGAR");assert.equal(r.principalMinor,7000000);assert.equal(r.abonadoMinor,2500000);assert.equal(r.saldoMinor,4500000);assert.equal(r.cuotaMinor,1000000);assert.equal(r.diaPago,15);assert.equal(r.frecuencia,"MENSUAL");assert.equal(r.estado,"LISTO")});

test("estructura la frase natural de la moto sin confundir día con dinero",()=>{
  const r=interprete.deudaEstructurada("Imagínate, que me compré una moto, la cual debo pagar cada 15 de cada mes, un millón de pesos, y ya he abonado 2 millones quinientos y la moto me costó 7 millones sin interés");
  assert.ok(r);
  assert.equal(r.principalMinor,7000000);
  assert.equal(r.abonadoMinor,2500000);
  assert.equal(r.saldoMinor,4500000);
  assert.equal(r.cuotaMinor,1000000);
  assert.equal(r.diaPago,15);
  assert.equal(r.tasaMensualPct,0);
  assert.equal(r.concepto,"Moto");
});
