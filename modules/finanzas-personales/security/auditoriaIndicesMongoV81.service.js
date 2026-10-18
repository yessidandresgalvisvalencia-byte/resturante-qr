"use strict";
// Auditoría read-only. No crea índices ni accede a saldos o datos personales.
function indiceExacto(indices,campos,{parcial=false}={}){
 return Array.isArray(indices)&&indices.some(i=>
  i.unique===true&&i.key&&Object.keys(i.key).length===campos.length&&
  campos.every(k=>i.key[k]===1)&&
  (!parcial||i.partialFilterExpression?.externalIdHash?.$type==="string"));
}
// Índices de rendimiento: la falta de ellos debe quedar visible, sin bloquear
// movimientos financieros cuando los índices únicos de seguridad sí existen.
function indiceConsultaExacto(indices,nombre,campos){
 return Array.isArray(indices)&&indices.some(i=>i?.name===nombre&&
  i.unique!==true&&i.key&&Object.keys(i.key).length===campos.length&&
  campos.every((k,pos)=>Object.keys(i.key)[pos]===k&&i.key[k]===1));
}
async function auditarConsultasHistoricasV81(modelo){
 const esperados=[
  ["fp_conciliacion_cuenta_periodo_v81",["usuarioId","cuentaId","fecha"]],
  ["fp_conciliacion_huerfanos_periodo_v81",["usuarioId","cuentaId","cuenta","fecha"]]
 ];
 let indices;
 try{indices=await modelo.collection.indexes();}catch(_){indices=[];}
 return esperados.map(([nombre,campos])=>({
  nombre,verificado:indiceConsultaExacto(indices,nombre,campos)
 }));
}
async function auditarIndicesMongoV81(modelos){
 const requeridos=[
  {nombre:"transacciones_idempotencia",modelo:modelos.transacciones,campos:["usuarioId","externalIdHash"],parcial:true},
  {nombre:"reservas_recurrentes",modelo:modelos.reservas,campos:["usuarioId","origenId","periodoInicio"]},
  {nombre:"vinculos_movimiento",modelo:modelos.vinculos,campos:["usuarioId","movimientoId"]},
  {nombre:"vinculos_idempotencia",modelo:modelos.vinculos,campos:["usuarioId","idempotencyKeyHash"]}
 ];
 const resultados=[];
 for(const item of requeridos){
  try{
   const indices=await item.modelo.collection.indexes();
   resultados.push({nombre:item.nombre,verificado:indiceExacto(indices,item.campos,{parcial:item.parcial})});
  }catch(_){
   resultados.push({nombre:item.nombre,verificado:false});
  }
 }
 const optimizacionConsultas=await auditarConsultasHistoricasV81(modelos.transacciones);
 return {integridadIndices:resultados.every(x=>x.verificado)?"VERIFICADA":"NO_VERIFICADA",resultados,optimizacionConsultas};
}
module.exports={indiceExacto,indiceConsultaExacto,auditarConsultasHistoricasV81,auditarIndicesMongoV81};
