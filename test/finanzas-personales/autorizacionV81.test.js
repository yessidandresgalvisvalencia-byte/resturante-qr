"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {resolverUsuarioAutorizadoV81}=require("../../modules/finanzas-personales/services/autorizacionV81.service");
const uno="507f1f77bcf86cd799439011";
const otro="507f191e810c19729de860ea";
test("V81 exige identidad autenticada verificable",()=>{
 for(const p of [null,{}, {autenticado:false,usuarioId:uno},{autenticado:true,usuarioId:"mal"}, {autenticado:true,usuarioId:77}])
  assert.throws(()=>resolverUsuarioAutorizadoV81(p),e=>e.statusCode===401);
 assert.equal(resolverUsuarioAutorizadoV81({autenticado:true,usuarioId:uno}),uno);
});
test("V81 bloquea selección de otro usuario por parámetros cliente",()=>{
 const principal={autenticado:true,usuarioId:uno};
 assert.equal(resolverUsuarioAutorizadoV81(principal,uno),uno);
 for(const solicitado of [otro,"mal",{},[""+uno]])
  assert.throws(()=>resolverUsuarioAutorizadoV81(principal,solicitado),e=>e.statusCode===403);
});
