"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const source=fs.readFileSync(path.join(__dirname,"../../modules/finanzas-personales/routes.js"),"utf8");
test("Backend V81 rechaza importes decimales e inseguros de créditos y metas",()=>{
 const {validarCredito}=require("../../modules/finanzas-personales/services/creacionPrestamoRecuperablePersonal.service");
 const datos={confirmacion:true,nombre:"Ensayo",contraparte:"Acreedor de ensayo",saldo:1000,cuotaMensual:100,mesesRestantes:10,periodicidadConfirmada:true,fechaSaldo:"2026-01-01T05:00:00.000Z",fechaProximoPago:null};
 const goal=source.match(/const meta=Joi\.object\(\{[^\n]+/);
 assert.ok(goal);
 for(const field of ["saldo","cuotaMensual"]){for(const valor of [0,-1,0.5,"100",Number.MAX_SAFE_INTEGER+1])assert.throws(()=>validarCredito({...datos,[field]:valor}));assert.doesNotThrow(()=>validarCredito({...datos,[field]:Number.MAX_SAFE_INTEGER}));}
 for(const field of ["objetivo","acumulado"])assert.match(goal[0],new RegExp(field+":Joi\\.number\\(\\)\\.integer\\(\\)"));
 assert.match(goal[0],/\.max\(Number\.MAX_SAFE_INTEGER\)/);
});
