"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {resumenDesde,diarioDesde}=require("../../modules/finanzas-personales/services/reportesCompensadosPersonal.service");
const row=(tipo,montoMinor,categoria="Otros",estado="ACTIVA")=>({tipo,montoMinor,categoria,estado,fecha:"2026-10-25T15:00:00.000Z",createdAt:"2026-10-25T15:00:00.000Z"});
test("informes usan categoría y tipo vigentes, excluyen anulados y no alteran entradas",()=>{
 const rows=[row("INGRESO",100000,"Salario"),row("GASTO",22000,"Comida"),row("GASTO",25000,"Comida","ANULADA")];
 const copia=structuredClone(rows),r=resumenDesde(rows);
 assert.deepEqual(r,{ingresos:100000,gastos:22000,balance:78000,categorias:{Salario:{ingresos:100000,gastos:0},Comida:{ingresos:0,gastos:22000}}});
 assert.equal(diarioDesde(rows,100)[0].balance,78000);assert.deepEqual(rows,copia);
});
test("categoría __proto__ permanece dato y los acumulados inseguros se rechazan",()=>{
 const r=resumenDesde([row("GASTO",100,"__proto__")]);
 assert.equal(Object.hasOwn(r.categorias,"__proto__"),true);
 assert.deepEqual(r.categorias.__proto__,{ingresos:0,gastos:100});
 assert.throws(()=>resumenDesde([row("INGRESO",Number.MAX_SAFE_INTEGER),row("INGRESO",1)]),/rango seguro/);
});
