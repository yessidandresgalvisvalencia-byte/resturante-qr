"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {crearConfirmacionVinculoHistoricoV81}=
 require("../../modules/finanzas-personales/services/confirmarVinculoHistoricoV81.handler");
const uid="507f1f77bcf86cd799439011";
async function responder(operacion){
 const res={headers:{},statusCode:200,body:null,
  set(k,v){this.headers[k]=v;return this;},
  status(x){this.statusCode=x;return this;},
  json(x){this.body=x;return this;}};
 await crearConfirmacionVinculoHistoricoV81(operacion)(
  {personalAuth:{verificado:true,userId:uid},validated:{}},res);
 return res;
}
test("respuesta de Mongo transitorio es 503 y no asegura confirmación",async()=>{
 const r=await responder(async()=>{throw Object.assign(new Error("WriteConflict"),{statusCode:503});});
 assert.equal(r.statusCode,503);
 assert.equal(r.body.ok,false);
 assert.match(r.body.error,/misma clave de idempotencia/);
 assert.doesNotMatch(r.body.error,/Índices/);
 assert.equal(r.headers["Cache-Control"],"no-store");
});
test("confirmación nueva e idempotente usan códigos 201 y 200",async()=>{
 const nueva=await responder(async()=>({confirmado:true,yaExistia:false,modificaSaldo:false}));
 const repetida=await responder(async()=>({confirmado:true,yaExistia:true,modificaSaldo:false}));
 assert.equal(nueva.statusCode,201);
 assert.equal(repetida.statusCode,200);
 assert.equal(repetida.body.modificaSaldo,false);
});
test("conflictos de vínculo regresan 409 sin afirmar escritura",async()=>{
 const r=await responder(async()=>{throw Object.assign(new Error("Vínculo contradictorio"),{statusCode:409});});
 assert.equal(r.statusCode,409);
 assert.equal(r.body.ok,false);
});
