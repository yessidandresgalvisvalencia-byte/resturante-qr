"use strict";
const test=require("node:test");const assert=require("node:assert/strict");
const interprete=require("../../modules/finanzas-personales/services/interpreteFinanciero.service");
const colombia=require("../../modules/finanzas-personales/services/colombiaFinanciero.service");
const home=require("../../modules/finanzas-personales/services/homePersonal.service");
test("colombianismos monetarios exactos",()=>{assert.equal(interprete.interpretarSegmento("gasté 25 lucas en Rappi").montoMinor,25000);assert.equal(interprete.interpretarSegmento("recibí 3 palos de salario").montoMinor,3000000);assert.equal(interprete.interpretarSegmento("me pagaron medio palo").montoMinor,500000);});
test("gasto hormiga colombiano",()=>{assert.equal(colombia.clasificar("me gasté 18 lucas en un cafecito","GASTO"),"Gastos hormiga");assert.equal(colombia.clasificar("pagué el SOAT","GASTO"),"Gastos fijos");});
test("no inventa monto aproximado",()=>{const x=interprete.interpretarSegmento("gasté más o menos 30 lucas");assert.equal(x.montoMinor,0);assert.equal(x.estado,"REQUIERE_REVISION");});
test("cuenta por cobrar no se convierte en ingreso",()=>{const x=interprete.cuentaPorCobrar("Juan me debe 50 lucas");assert.equal(x.tipo,"CUENTA_POR_COBRAR");assert.equal(x.montoMinor,50000);});

test("fecha Colombia produce una fecha válida",()=>{const d=colombia.fechaColombia(0);assert.equal(Number.isNaN(d.getTime()),false);});

test("decimales colombianos se escalan sin float",()=>{assert.equal(interprete.interpretarSegmento("recibí 1.5 millones de salario").montoMinor,1500000);assert.equal(interprete.interpretarSegmento("gasté 2,5 lucas en café").montoMinor,2500);});
test("monto corto sin unidad exige revisión",()=>{const x=interprete.interpretarSegmento("gasté 20 en bus");assert.equal(x.estado,"REQUIERE_REVISION");assert.match(x.razonRevision,/ambiguo/i);});
test("vocabulario colombiano adicional",()=>{assert.equal(colombia.clasificar("hice un rebusque","INGRESO"),"Salario");assert.equal(colombia.clasificar("pagué el pagadiario","GASTO"),"Deuda");assert.equal(colombia.clasificar("compré mecato","GASTO"),"Gastos hormiga");});

test("clasificación no confunde transporte Didi con Didi Food",()=>{assert.equal(colombia.clasificar("pagué un Didi para ir al trabajo","GASTO"),"Gastos variables");assert.equal(colombia.clasificar("pedí Didi Food","GASTO"),"Gastos hormiga");});

test("parser canónico expuesto conserva semántica colombiana",()=>{assert.equal(interprete.parseMontoExacto("2,5 lucas"),2500);assert.equal(interprete.parseMontoExacto("1.5 millones"),1500000);assert.equal(interprete.parseMontoExacto("más o menos 30 lucas"),null);});
test("monto ambiguo desnudo no se vuelve treinta mil",()=>{const x=interprete.interpretarSegmento("gasté 30 en bus");assert.equal(x.montoMinor,30);assert.equal(x.estado,"REQUIERE_REVISION");});

test("corte mensual corresponde a medianoche Colombia",()=>{const d=new Date("2026-10-01T04:30:00.000Z");assert.equal(home._fechas.monthStart(d).toISOString(),"2026-09-01T05:00:00.000Z");assert.equal(home._fechas.nextMonth(d).toISOString(),"2026-10-01T05:00:00.000Z");});
test("fecha civil Colombia conserva fin de febrero",()=>{assert.equal(home._fechas.fechaCivilColombia(2027,2,31).toISOString(),"2027-02-28T05:00:00.000Z");});
