"use strict";
const {iniciarRedisV81}=require("./iniciarRedisV81.service");
const {crearFabricaClienteRedisV81}=require("./fabricaClienteRedisV81.service");
// Entrada de arranque independiente. Inyectar 'redis' desde el host, sin cambiar su package.json.
async function iniciarControlRedisV81(app,{redis,url=process.env.GRUK_V81_REDIS_URL}={}){
 if(process.env.GRUK_V81_RATE_LIMIT_MODE!=="redis")throw new Error("GRUK_V81_RATE_LIMIT_MODE=redis requerido");
 if(!redis||typeof redis.createClient!=="function")throw new TypeError("Dependencia redis no instalada");
 return iniciarRedisV81(app,{crearCliente:crearFabricaClienteRedisV81(redis),url});
}
module.exports={iniciarControlRedisV81};
