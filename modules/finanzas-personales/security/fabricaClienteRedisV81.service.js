"use strict";
// Adaptador pequeño de cliente Redis para el arranque independiente de Finanzas Personales.
// Se inyecta la librería oficial redis, sin modificar package.json empresarial.
function crearFabricaClienteRedisV81(redis){
 if(!redis||typeof redis.createClient!=="function")throw new TypeError("Módulo redis requerido");
 return ({url})=>{
  const client=redis.createClient({url, socket:{reconnectStrategy:retries=>Math.min(100*2**Math.min(retries,5),3000)}});
  // Sólo operaciones usadas por el limitador; conexión y TLS las valida iniciarRedisV81.
  if(!client||typeof client.eval!=="function"||typeof client.connect!=="function"||typeof client.ping!=="function")
   throw new TypeError("Cliente Redis incompatible");
  client.on("error",()=>{}); // evita error sin observador; no expone URL ni secretos.
  return client;
 };
}
module.exports={crearFabricaClienteRedisV81};
