"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const {auditarAnclaCustodiada} = require("../../modules/finanzas-personales/services/auditoriaAnclaCustodiada.service");
const KEY = Buffer.alloc(32,0x59);

test("custodio no recibe identificadores inválidos ni claves débiles", async () => {
 let consultas = 0;
 const custodio = {obtenerUltimaAncla:async()=>{ consultas++; return null; }};
 for (const id of ["", "invalido", "123", null, {}]) {
  await assert.rejects(()=>auditarAnclaCustodiada(id,KEY,custodio),TypeError);
 }
 const id = new mongoose.Types.ObjectId();
 for (const clave of [null, Buffer.alloc(8), "clave-insegura"]) {
  await assert.rejects(()=>auditarAnclaCustodiada(id,clave,custodio),TypeError);
 }
 assert.equal(consultas,0);
});

test("custodio recibe id canónico y nunca da éxito con referencia ausente",async()=>{
 const id = new mongoose.Types.ObjectId();
 const consultas=[];
 const resultado=await auditarAnclaCustodiada(id,KEY,{
  obtenerUltimaAncla:async(usuarioId)=>{
   consultas.push(usuarioId);
   return null;
  }
 });
 assert.deepEqual(consultas,[String(id)]);
 assert.deepEqual(resultado,{valida:false,codigo:"ANCLA_EXTERNA_NO_DISPONIBLE"});
});
