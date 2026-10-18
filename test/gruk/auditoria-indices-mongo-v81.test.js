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

test("informa ausencia de índices de rendimiento sin tumbar el ledger",async()=>{
 const r=await auditarIndicesMongoV81(base);
 assert.equal(r.integridadIndices,"VERIFICADA");
 assert.equal(r.optimizacionConsultas.length,2);
 assert.ok(r.optimizacionConsultas.every(x=>x.verificado===false));
});
test("comprueba orden y nombre de índices físicos de consulta",async()=>{
 const {indiceConsultaExacto,auditarConsultasHistoricasV81}=
  require("../../modules/finanzas-personales/security/auditoriaIndicesMongoV81.service");
 const ix=[
  {name:"fp_conciliacion_cuenta_periodo_v81",key:{usuarioId:1,cuentaId:1,fecha:1}},
  {name:"fp_conciliacion_huerfanos_periodo_v81",key:{usuarioId:1,cuentaId:1,cuenta:1,fecha:1}}
 ];
 const resultado=await auditarConsultasHistoricasV81({collection:{indexes:async()=>ix}});
 assert.ok(resultado.every(x=>x.verificado));
 assert.equal(indiceConsultaExacto(ix,"fp_conciliacion_cuenta_periodo_v81",["cuentaId","usuarioId","fecha"]),false);
 assert.equal(indiceConsultaExacto([{...ix[0],unique:true}],ix[0].name,["usuarioId","cuentaId","fecha"]),false);
 const ausencia=await auditarConsultasHistoricasV81({collection:{indexes:async()=>{throw Error("sin DB")}}});
 assert.ok(ausencia.every(x=>x.verificado===false));
});
