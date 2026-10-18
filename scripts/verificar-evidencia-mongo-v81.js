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
 const canceladas=marcador("cancelled"),pendientes=marcador("todo");
 if(pruebas<2||aprobadas!==pruebas||fallidas!==0||omitidas!==0||
    canceladas!==0||pendientes!==0)
  throw new Error("MONGO_V81_NO_APROBADO: "+JSON.stringify({
   pruebas,aprobadas,fallidas,omitidas,canceladas,pendientes
  }));
 const lineas=contenido.split(/\r?\n/);
 const planes=lineas.filter(x=>/^1\.\.[0-9]+\s*$/.test(x));
 if(planes.length!==1||planes[0]!==("1.."+pruebas))
  throw new Error("PLAN_TAP_INVALIDO");
 // No basta el resumen del runner: contrastar cada caso y su numeración.
 const casos=lineas.filter(x=>/^(?:ok|not ok) [0-9]+ - /.test(x));
 if(casos.length!==pruebas)throw new Error("RESULTADOS_TAP_INCOMPLETOS");
 const vistos=new Set();
 for(const linea of casos){
  const m=/^(ok|not ok) ([0-9]+) - (.+)$/.exec(linea);
  const id=Number(m[2]);
  if(m[1]!=="ok"||!Number.isSafeInteger(id)||id<1||id>pruebas||
     vistos.has(id)||/#\s*(?:SKIP|TODO)\b/i.test(m[3]))
   throw new Error("RESULTADO_TAP_INVALIDO");
  vistos.add(id);
 }
 const obligatorias=[
  "Mongo local: dos confirmaciones idénticas crean exactamente un vínculo",
  "DecisionProof serializa dos escrituras concurrentes sin huérfanos"
 ];
 for(const nombre of obligatorias){
  if(casos.filter(x=>x.replace(/^ok [0-9]+ - /,"")===nombre).length!==1)
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
