"use strict";
const {indiceExacto}=require("../security/auditoriaIndicesMongoV81.service");
// Fail-closed: sin índice único real, dos solicitudes concurrentes con
// el mismo externalId podrían crear movimientos duplicados.
function indiceIdempotenciaValido(indices){
 return indiceExacto(indices,["usuarioId","externalIdHash"],{parcial:true});
}
async function exigirIndiceIdempotencia(Transaccion){
 let indices;
 try{indices=await Transaccion.collection.indexes();}
 catch(_){throw Object.assign(new Error("Índice de idempotencia no disponible"),{statusCode:503});}
 if(!indiceIdempotenciaValido(indices))
  throw Object.assign(new Error("Índice único de idempotencia no configurado"),{statusCode:503});
}
module.exports={indiceIdempotenciaValido,exigirIndiceIdempotencia};
