"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const source=fs.readFileSync(path.join(__dirname,"../../modules/finanzas-personales/routes.js"),"utf8");
test("Backend V81 rechaza importes decimales e inseguros de créditos y metas",()=>{
 const {validarCredito}=require("../../modules/finanzas-personales/services/creacionPrestamoRecuperablePersonal.service");
 const datos={confirmacion:true,nombre:"Ensayo",contraparte:"Acreedor de ensayo",saldo:1000,cuotaMensual:100,mesesRestantes:10,periodicidadConfirmada:true,fechaSaldo:"2026-01-01T05:00:00.000Z",fechaProximoPago:null};
 const {validarSolicitud}=require("../../modules/finanzas-personales/services/creacionMetaRecuperablePersonal.service");
 for(const field of ["saldo","cuotaMensual"]){for(const valor of [0,-1,0.5,"100",Number.MAX_SAFE_INTEGER+1])assert.throws(()=>validarCredito({...datos,[field]:valor}));assert.doesNotThrow(()=>validarCredito({...datos,[field]:Number.MAX_SAFE_INTEGER}));}
 for(const field of ["objetivo","acumulado"])for(const valor of [-1,0.5,"100",Number.MAX_SAFE_INTEGER+1])assert.throws(()=>validarSolicitud({nombre:"Ensayo",objetivo:1000,acumulado:0,fechaObjetivo:null,confirmacion:true,[field]:valor}));
});
