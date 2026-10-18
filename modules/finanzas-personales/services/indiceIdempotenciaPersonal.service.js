"use strict";
// Fail-closed: sin índice único real, dos solicitudes concurrentes con
// el mismo externalId podrían crear movimientos duplicados.
function indiceIdempotenciaValido(indices){
 return Array.isArray(indices)&&indices.some(indice=>{
  const claves=indice?.key;
  const filtro=indice?.partialFilterExpression;
  return indice.unique===true&&claves?.usuarioId===1&&claves?.externalIdHash===1&&
   Object.keys(claves).length===2&&
   filtro?.externalIdHash?.$type==="string";
 });
}
async function exigirIndiceIdempotencia(Transaccion){
 let indices;
 try{indices=await Transaccion.collection.indexes();}
 catch(_){throw Object.assign(new Error("Índice de idempotencia no disponible"),{statusCode:503});}
 if(!indiceIdempotenciaValido(indices))
  throw Object.assign(new Error("Índice único de idempotencia no configurado"),{statusCode:503});
}
module.exports={indiceIdempotenciaValido,exigirIndiceIdempotencia};
