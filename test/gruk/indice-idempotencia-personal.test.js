"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {indiceIdempotenciaValido,exigirIndiceIdempotencia}=
 require("../../modules/finanzas-personales/services/indiceIdempotenciaPersonal.service");
const correcto={unique:true,key:{usuarioId:1,externalIdHash:1},
 partialFilterExpression:{externalIdHash:{$type:"string"}}};
test("acepta solo el índice único compuesto y parcial esperado",()=>{
 assert.equal(indiceIdempotenciaValido([correcto]),true);
 assert.equal(indiceIdempotenciaValido([{...correcto,unique:false}]),false);
 assert.equal(indiceIdempotenciaValido([{...correcto,key:{externalIdHash:1}}]),false);
 assert.equal(indiceIdempotenciaValido([{...correcto,key:{usuarioId:1,externalIdHash:1,fecha:1}}]),false);
 assert.equal(indiceIdempotenciaValido([{...correcto,partialFilterExpression:{}}]),false);
 assert.equal(indiceIdempotenciaValido(null),false);
});
test("la escritura rechaza índices debilitados aunque conserven claves y unique",async()=>{
 for(const opciones of [
  {sparse:true},{expireAfterSeconds:0},{collation:{locale:"es",strength:1}},
  {partialFilterExpression:{externalIdHash:{$type:"string"},origen:"MANUAL"}},
  {partialFilterExpression:{externalIdHash:{$type:"string",$gt:"a"}}},
  {key:{externalIdHash:1,usuarioId:1}}
 ]){
  const indice={...correcto,...opciones};
  assert.equal(indiceIdempotenciaValido([indice]),false);
  await assert.rejects(exigirIndiceIdempotencia({collection:{indexes:async()=>[indice]}}),e=>e.statusCode===503);
 }
 assert.equal(indiceIdempotenciaValido([null,{},correcto]),true);
});
test("falla cerrado si Mongo no devuelve índices",async()=>{
 await assert.rejects(exigirIndiceIdempotencia({collection:{indexes:async()=>{throw Error("sin conexión");}}}),
  error=>error.statusCode===503);
});
test("falla cerrado si el índice no existe y acepta el correcto",async()=>{
 await assert.rejects(exigirIndiceIdempotencia({collection:{indexes:async()=>[]}}),
  error=>error.statusCode===503);
 await assert.doesNotReject(exigirIndiceIdempotencia({collection:{indexes:async()=>[correcto]}}));
});
