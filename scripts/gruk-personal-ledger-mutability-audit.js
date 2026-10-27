"use strict";
const fs=require("node:fs");
const path=require("node:path");

function analizarMutacionesLedger(codigo){
 if(typeof codigo!=="string")throw new TypeError("Se requiere código para la auditoría");
 const patrones=[
  {id:"CORRECCION_ORIGINAL",detecta:/Object\.assign\s*\(\s*anterior\s*,\s*permitidos\s*\)/,descripcion:"corrección muta documento original"},
  {id:"SAVE_CORRECCION",detecta:/await\s+anterior\.save\s*\(/,descripcion:"corrección persiste modificación sobre documento original"},
  {id:"ANULACION_ESTADO",detecta:/\btx\.estado\s*=\s*["']ANULADA["']/,descripcion:"anulación muta estado del documento original"},
  {id:"SAVE_ANULACION",detecta:/await\s+tx\.save\s*\(/,descripcion:"anulación persiste modificación sobre documento original"}
 ];
 return patrones.filter(p=>p.detecta.test(codigo)).map(p=>({id:p.id,descripcion:p.descripcion}));
}
function auditarProyecto(raiz=path.resolve(__dirname,"..")){
 const archivos=["services/flujoCajaPersonal.service.js","routes.js",
  "services/patrimonioPersonal.service.js","services/compromisosCuotas.service.js"];
 return archivos.flatMap(archivo=>{
  const codigo=fs.readFileSync(path.join(raiz,"modules/finanzas-personales",archivo),"utf8");
  const mutaciones=analizarMutacionesLedger(codigo).filter(h=>archivo.startsWith("services/flujoCaja")||
   ["ANULACION_ESTADO","SAVE_ANULACION"].includes(h.id));
  for(const m of codigo.matchAll(/\b(?:Transaccion|Tx)\.(?:updateOne|updateMany|findOneAndUpdate|replaceOne|deleteOne|deleteMany)\s*\(/g))
   mutaciones.push({id:"MUTACION_MODELO_ORIGINAL",descripcion:"operación de modificación sobre el modelo financiero",linea:codigo.slice(0,m.index).split("\n").length});
  return mutaciones.map(h=>({archivo,...h}));
 });
}
function main(args=process.argv.slice(2)){
 const hallazgos=auditarProyecto();
 if(hallazgos.length){
  process.stderr.write("[GRUK PERSONAL] Ledger NO certificado append-only: "+hallazgos.map(h=>h.archivo+":"+h.id).join(", ")+"\n");
  process.stderr.write("Bloqueador de liberación: https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/issues/407\n");
 }else process.stdout.write("[GRUK PERSONAL] No se encontraron estos patrones de mutación; requiere auditoría adicional.\n");
 if(args.includes("--enforce")&&hallazgos.length)process.exitCode=1;
 return hallazgos;
}
if(require.main===module)main();
module.exports={analizarMutacionesLedger,auditarProyecto,main};
