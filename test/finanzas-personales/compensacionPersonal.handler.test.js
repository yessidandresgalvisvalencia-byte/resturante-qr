"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {crearHandler}=require("../../modules/finanzas-personales/services/compensacionPersonal.handler");
function respuesta(){return{statusCode:200,set(){return this;},status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}};}
const req={personalAuth:{userId:"usuario_autenticado"},params:{id:"movimiento"},headers:{"idempotency-key":"operacion_1"},validated:{montoMinor:22000}};
test("handler exige sesión y clave antes de escribir",async()=>{
 let llamadas=0;const h=crearHandler({tipo:"CORRECCION",aplicar:async()=>{llamadas++;}});
 for(const [entrada,status] of [[{...req,personalAuth:null},401],[{...req,headers:{}},400]]){
  const res=respuesta();await h(entrada,res);assert.equal(res.statusCode,status);
 }
 assert.equal(llamadas,0);
});
test("identidad viene de autenticación y la anulación ignora cambios del cuerpo",async()=>{
 let entrada;const h=crearHandler({tipo:"ANULACION",aplicar:async x=>{entrada=x;return{movimientoId:x.movimientoId,original:{tipo:"GASTO",montoMinor:25000},cambios:{}};}});
 const res=respuesta();await h({...req,body:{usuarioId:"intruso"}},res);
 assert.equal(entrada.usuarioId,"usuario_autenticado");assert.deepEqual(entrada.cambios,{});
 assert.equal(res.body.transaccion.estado,"ANULADA");
});
test("un error interno no expone detalles del servidor",async()=>{
 const h=crearHandler({tipo:"CORRECCION",aplicar:async()=>{throw Error("dato_privado");}});
 const res=respuesta();await h(req,res);assert.equal(res.statusCode,500);
 assert.doesNotMatch(JSON.stringify(res.body),/dato_privado/);
});
