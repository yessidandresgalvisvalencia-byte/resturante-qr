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

const homePersonal=require("../../modules/finanzas-personales/services/homePersonal.service");
test("solo una cuota con vencimiento dentro del mes compromete flujo",()=>{
 const inicio=new Date(2026,9,1),fin=new Date(2026,10,1);
 assert.equal(homePersonal.cuotaDelPeriodo({direccion:"POR_PAGAR",estado:"ACTIVO",saldoMinor:4500000,cuotaMinor:1000000,fechaVencimiento:new Date(2026,9,15)},inicio,fin),1000000);
 assert.equal(homePersonal.cuotaDelPeriodo({direccion:"POR_PAGAR",estado:"ACTIVO",saldoMinor:4500000,cuotaMinor:1000000,fechaVencimiento:new Date(2026,10,15)},inicio,fin),0);
});
test("el principal total nunca se usa como cuota mensual",()=>{
 const inicio=new Date(2026,9,1),fin=new Date(2026,10,1);
 assert.equal(homePersonal.cuotaDelPeriodo({direccion:"POR_PAGAR",estado:"ACTIVO",saldoMinor:4500000,cuotaMinor:1000000,fechaVencimiento:new Date(2026,9,15)},inicio,fin),1000000);
});

test("la deuda de moto conserva última cuota parcial sin sobrepago",()=>{
 const r=interprete.deudaEstructurada("Compré una moto de 7 millones, ya aboné 2 millones quinientos, pago un millón cada día 15 y es sin interés");
 assert.equal(r.saldoMinor,4500000);assert.equal(r.cuotaMinor,1000000);
 assert.deepEqual([1000000,1000000,1000000,1000000,500000].reduce((a,x)=>a+x,0),r.saldoMinor);
});
test("contrato de aprobación permite ítems independientes",()=>{
 const fs=require("node:fs"),path=require("node:path");
 const src=fs.readFileSync(path.join(__dirname,"..","..","modules","finanzas-personales","services","aprobacionConversacional.service.js"),"utf8");
 const routes=fs.readFileSync(path.join(__dirname,"..","..","modules","finanzas-personales","routes.js"),"utf8");
 assert.match(src,/estado==="LISTO"/);assert.match(src,/estadoAprobacion!=="APROBADO"/);
 assert.doesNotMatch(src,/b\.items\.some\(x=>x\.estado!=="LISTO"\)/);
 assert.match(src,/b\.estado=pendientes\.length\?"PARCIAL":"APROBADO"/);
 assert.match(routes,/items\/:itemId\/aprobar/);
});

test("parser colombiano entiende cantidades monetarias escritas",()=>{
 assert.equal(interprete.parseMontoExacto("un millón"),1000000);
 assert.equal(interprete.parseMontoExacto("dos millones quinientos"),2500000);
 assert.equal(interprete.parseMontoExacto("500 lucas"),500000);
});
