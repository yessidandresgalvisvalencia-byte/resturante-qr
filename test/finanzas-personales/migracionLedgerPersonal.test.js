"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {minor,reporte,indiceSeguro}=require("../../modules/finanzas-personales/services/migracionLedgerPersonal.service");
const fila=(hash,tipo,monto)=>({usuarioId:"usuario",tipo,montoMinor:monto,moneda:"COP",concepto:"Histórico",categoria:"Prueba",subcategoria:"",fecha:new Date("2026-10-01T15:00:00Z"),origen:"SISTEMA",externalIdHash:hash});
test("migración conserva COP enteros y rechaza redondeo o coerción",()=>{
 assert.equal(minor(1000),1000);
 for(const n of [0,-1,1.5,"1000",NaN,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>minor(n),e=>e.statusCode===422);
});
test("reconciliación compara cada fuente y no solo el saldo neto",()=>{
 const fuentes=[fila("a","INGRESO",1000),fila("b","GASTO",250)];
 assert.equal(reporte(fuentes,fuentes.map(x=>({...x}))).estado,"RECONCILIADA");
 const intercambiado=[{...fuentes[0],montoMinor:1010},{...fuentes[1],montoMinor:260}];
 const r=reporte(fuentes,intercambiado);assert.equal(r.diferenciaMinor,0);assert.equal(r.estado,"ERROR");
 assert.equal(reporte(fuentes,[{...fuentes[0],concepto:"Distinto"},fuentes[1]]).estado,"ERROR");
 assert.equal(reporte(fuentes,[fuentes[0]]).estado,"ERROR");
});
test("sumas exactas rechazan desbordes y duplicados antes de certificar la importación",()=>{
 const filas=[fila("a","INGRESO",Number.MAX_SAFE_INTEGER),fila("b","INGRESO",1)];
 assert.throws(()=>reporte(filas,filas),e=>e.statusCode===422);
 assert.throws(()=>reporte([filas[0]],[filas[0],filas[0]]),/duplicados/);
});
test("índices parciales o sparse no sustituyen la unicidad completa de migración",()=>{
 const index={key:{usuarioId:1,version:1},unique:true};
 assert.equal(indiceSeguro([index],["usuarioId","version"]),true);
 assert.equal(indiceSeguro([{...index,sparse:true}],["usuarioId","version"]),false);
 assert.equal(indiceSeguro([{...index,partialFilterExpression:{version:"movimientos-v1"}}],["usuarioId","version"]),false);
 const parcial={key:{usuarioId:1,externalIdHash:1},unique:true,partialFilterExpression:{externalIdHash:{$type:"string"}}};
 assert.equal(indiceSeguro([parcial],["usuarioId","externalIdHash"],{parcial:true}),true);
 assert.equal(indiceSeguro([{...parcial,partialFilterExpression:{...parcial.partialFilterExpression,estado:"ACTIVA"}}],["usuarioId","externalIdHash"],{parcial:true}),false);
});
