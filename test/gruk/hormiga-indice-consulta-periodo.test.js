"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const Transaccion=require("../../modules/finanzas-personales/models/TransaccionPersonal");
const consulta=require("../../modules/finanzas-personales/services/consultaCompensadaPersonal.service");
const {obtener}=require("../../modules/finanzas-personales/services/gastosHormigaResumen.service");
test("existe índice de lectura por usuario y fecha sin filtrar campos compensables",()=>{
 assert.ok(Transaccion.schema.indexes().some(([k])=>k.usuarioId===1&&k.fecha===-1&&Object.keys(k).length===2));
});
test("resumen solicita identidad y ventana exactas al lector compensado",async()=>{
 const original=consulta.consultarPeriodo;let capturado;
 consulta.consultarPeriodo=async p=>{capturado=p;return [];};
 try{
  const r=await obtener("persona-uno",{ahora:new Date("2026-10-20T15:00:00Z")});
  assert.equal(r.consumoTotalSemanaMinor,0);
  assert.deepEqual(capturado,{usuarioId:"persona-uno",tipo:"GASTO",desde:"2026-10-01T05:00:00.000Z",hasta:"2026-10-20T15:00:00.001Z"});
 }finally{consulta.consultarPeriodo=original;}
});
test("fallos y timeouts del lector se propagan sin publicar ceros",async()=>{
 const original=consulta.consultarPeriodo,timeout=Object.assign(Error("operation exceeded time limit"),{code:50});
 consulta.consultarPeriodo=async()=>{throw timeout;};
 try{await assert.rejects(obtener("persona-uno",{ahora:new Date("2026-10-20T15:00:00Z")}),e=>e===timeout);}
 finally{consulta.consultarPeriodo=original;}
});
