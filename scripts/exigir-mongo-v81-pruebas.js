"use strict";
// Guardia para el comando de integración dedicado: nunca autorizar producción ni host remoto.
const uri=process.env.GRUK_V81_TEST_MONGO_URI;
function validarMongoPruebasV81(uri,env=process.env.NODE_ENV){
 if(env==="production")throw new Error("V81: prohibido ejecutar pruebas de escritura bajo NODE_ENV=production");
 if(typeof uri!=="string"||!uri)throw new Error("V81: define GRUK_V81_TEST_MONGO_URI para la prueba real; omitir no es aprobar");
 let parsed;
 try{parsed=new URL(uri);}catch{throw new Error("V81: URI MongoDB inválida");}
 if(parsed.protocol!=="mongodb:")throw new Error("V81: usar mongodb:// local, no SRV ni nube");
 if(!["127.0.0.1","localhost","::1","[::1]"].includes(parsed.hostname))
  throw new Error("V81: solamente se permite MongoDB en loopback");
 if(parsed.username||parsed.password)throw new Error("V81: no usar credenciales en la prueba local");
 if(!/^\/gruk_v81_test_[a-z0-9_-]+$/i.test(parsed.pathname))
  throw new Error("V81: la URI debe indicar explícitamente una base gruk_v81_test_*");
 if(parsed.searchParams.get("replicaSet")===null)
  throw new Error("V81: se requiere replicaSet local con transacciones");
 return true;
}
if(require.main===module){
 try{validarMongoPruebasV81(uri);console.log("V81: destino MongoDB local de pruebas validado");}
 catch(error){console.error(error.message);process.exitCode=1;}
}
module.exports={validarMongoPruebasV81};
