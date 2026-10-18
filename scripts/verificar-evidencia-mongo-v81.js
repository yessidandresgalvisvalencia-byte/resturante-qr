"use strict";
const fs=require("node:fs");
function validarEvidenciaMongoV81(contenido){
 if(typeof contenido!=="string")throw new TypeError("Evidencia TAP inválida");
 const marcador=(clave)=>{
  const resultados=[...contenido.matchAll(new RegExp("^# "+clave+" (\\d+)\\s*$","gm"))];
  if(resultados.length!==1)throw new Error("RESUMEN_TAP_AUSENTE_O_DUPLICADO: "+clave);
  return Number(resultados[0][1]);
 };
 const pruebas=marcador("tests"),aprobadas=marcador("pass");
 const fallidas=marcador("fail"),omitidas=marcador("skipped");
 if(pruebas<2||aprobadas!==pruebas||fallidas!==0||omitidas!==0)
  throw new Error("MONGO_V81_NO_APROBADO: "+JSON.stringify({pruebas,aprobadas,fallidas,omitidas}));
 const obligatorias=[
  "Mongo local: dos confirmaciones idénticas crean exactamente un vínculo",
  "DecisionProof serializa dos escrituras concurrentes sin huérfanos"
 ];
 for(const nombre of obligatorias){
  const linea=contenido.split(/\r?\n/).find(x=>/^ok \d+ - /.test(x)&&
   x.includes(" - "+nombre));
  if(!linea||/# SKIP|# TODO/.test(linea))
   throw new Error("PRUEBA_MONGO_OBLIGATORIA_AUSENTE: "+nombre);
 }
 return {pruebas,aprobadas,fallidas,omitidas};
}
if(require.main===module){
 try{
  const ruta=process.argv[2];
  if(!ruta)throw new Error("RUTA_EVIDENCIA_REQUERIDA");
  const resultado=validarEvidenciaMongoV81(fs.readFileSync(ruta,"utf8"));
  console.log("[GRUK_V81_MONGO_CI] VALIDADO",JSON.stringify(resultado));
 }catch(e){
  console.error("[GRUK_V81_MONGO_CI] BLOQUEADO",e.message);
  process.exitCode=1;
 }
}
module.exports={validarEvidenciaMongoV81};
