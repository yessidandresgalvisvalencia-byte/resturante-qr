"use strict";
// Auditoría read-only. No crea índices ni accede a saldos o datos personales.
function indiceExacto(indices,campos,{parcial=false}={}){
 return Array.isArray(indices)&&indices.some(i=>
  i.unique===true&&i.key&&Object.keys(i.key).length===campos.length&&
  campos.every(k=>i.key[k]===1)&&
  (!parcial||i.partialFilterExpression?.externalIdHash?.$type==="string"));
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
 return {integridadIndices:resultados.every(x=>x.verificado)?"VERIFICADA":"NO_VERIFICADA",resultados};
}
module.exports={indiceExacto,auditarIndicesMongoV81};
