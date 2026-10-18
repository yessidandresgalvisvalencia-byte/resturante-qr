"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {indiceExacto,auditarIndicesMongoV81}=require("../../modules/finanzas-personales/security/auditoriaIndicesMongoV81.service");
const unique=(key,partialFilterExpression)=>({key,unique:true,...(partialFilterExpression?{partialFilterExpression}:{})});
const base={
 transacciones:{collection:{indexes:async()=>[unique({usuarioId:1,externalIdHash:1},{externalIdHash:{$type:"string"}})]}},
 reservas:{collection:{indexes:async()=>[unique({usuarioId:1,origenId:1,periodoInicio:1})]}},
 vinculos:{collection:{indexes:async()=>[unique({usuarioId:1,movimientoId:1}),unique({usuarioId:1,idempotencyKeyHash:1})]}}
};
test("indices reales requeridos se identifican",async()=>{
 const r=await auditarIndicesMongoV81(base);
 assert.equal(r.integridadIndices,"VERIFICADA");
 assert.equal(r.resultados.length,4);
});
test("falla cerrado ante indice ausente",async()=>{
 const r=await auditarIndicesMongoV81({...base,reservas:{collection:{indexes:async()=>[]}}});
 assert.equal(r.integridadIndices,"NO_VERIFICADA");
});
test("idempotencia requiere filtro parcial",()=>{
 assert.equal(indiceExacto([unique({usuarioId:1,externalIdHash:1})],["usuarioId","externalIdHash"],{parcial:true}),false);
});
