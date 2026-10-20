"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {persistirSnapshot}=require("../../modules/finanzas-personales/services/macroCollector.service");
const snapshot=Object.freeze({pais:"CO",moneda:"COP",fechaCorte:new Date("2026-09-30T00:00:00.000Z"),inflacionAnualPct:5.1,tasaLibreRiesgoPct:11.409,fuenteInflacion:"DANE",fuenteTasa:"Banco de la Republica"});
function repositorio({error=null,previo=null}={}){
 const llamadas={crear:0,leer:0};
 const modelo={
  async create(valor){llamadas.crear++;if(error)throw error;return {...valor,_id:"nuevo"}},
  findOne(filtro){llamadas.leer++;assert.equal(filtro.pais,"CO");assert.deepEqual(filtro.fechaCorte,snapshot.fechaCorte);return{lean:async()=>previo};}
 };
 return{modelo,llamadas};
}
test("observacion nueva se inserta exactamente una vez",async()=>{
 const {modelo,llamadas}=repositorio();
 const creado=await persistirSnapshot(snapshot,{modelo});
 assert.equal(creado._id,"nuevo");
 assert.deepEqual(llamadas,{crear:1,leer:0});
});
test("duplicado identico conserva el registro existente sin UPDATE ni DELETE",async()=>{
 const guardado={...snapshot,_id:"existente",fuenteTasa:"Otro acceso oficial"};
 const {modelo,llamadas}=repositorio({error:{code:11000},previo:guardado});
 assert.equal((await persistirSnapshot(snapshot,{modelo}))._id,"existente");
 assert.deepEqual(llamadas,{crear:1,leer:1});
});
test("duplicado con tasa distinta falla cerrado y no altera cifras historicas",async()=>{
 const {modelo}=repositorio({error:{code:11000},previo:{...snapshot,tasaLibreRiesgoPct:11.5}});
 await assert.rejects(persistirSnapshot(snapshot,{modelo}),e=>e.code==="MACRO_SNAPSHOT_CONFLICT");
});
test("duplicado sin observacion para el corte no oculta un conflicto en otro indice",async()=>{
 const error={code:11000};const {modelo}=repositorio({error,previo:null});
 await assert.rejects(persistirSnapshot(snapshot,{modelo}),e=>e===error);
});
test("errores reales de base de datos no son silenciados",async()=>{
 const error=new Error("Sin conexion a Mongo");const {modelo}=repositorio({error});
 await assert.rejects(persistirSnapshot(snapshot,{modelo}),e=>e===error);
});
