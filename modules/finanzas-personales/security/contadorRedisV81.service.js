"use strict";
// Redis compatible con EVAL: contador y TTL en una operación atómica.
// Se inyecta un cliente autenticado; nunca construir conexiones desde parámetros HTTP.
const SCRIPT=`
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('TTL', KEYS[1])
if ttl < 1 then
 redis.call('EXPIRE', KEYS[1], ARGV[1])
 ttl = redis.call('TTL', KEYS[1])
end
return {count, ttl}
`;
function crearIncrementadorRedisV81(cliente){
 if(!cliente||typeof cliente.eval!=="function")throw new TypeError("Cliente Redis EVAL obligatorio");
 return async function incrementar(clave,ventanaSegundos){
  if(typeof clave!=="string"||!/^fin:v81:write:[a-f0-9]{24}$/.test(clave)||
     !Number.isSafeInteger(ventanaSegundos)||ventanaSegundos<1||ventanaSegundos>3600)
   throw new TypeError("Parámetros Redis inválidos");
  const resultado=await cliente.eval(SCRIPT,{keys:[clave],arguments:[String(ventanaSegundos)]});
  if(!Array.isArray(resultado)||resultado.length!==2)throw new Error("Respuesta Redis inválida");
  const [cantidad,restanteSegundos]=resultado.map(Number);
  if(!Number.isSafeInteger(cantidad)||cantidad<1||!Number.isSafeInteger(restanteSegundos)||
     restanteSegundos<1||restanteSegundos>ventanaSegundos)throw new Error("Respuesta Redis inválida");
  return {cantidad,restanteSegundos};
 };
}
module.exports={crearIncrementadorRedisV81,SCRIPT};
