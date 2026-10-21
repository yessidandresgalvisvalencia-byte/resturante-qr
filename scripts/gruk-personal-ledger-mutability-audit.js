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
function main(args=process.argv.slice(2)){
 const ruta=path.join(__dirname,"../modules/finanzas-personales/services/flujoCajaPersonal.service.js");
 const hallazgos=analizarMutacionesLedger(fs.readFileSync(ruta,"utf8"));
 if(hallazgos.length){
  process.stderr.write("[GRUK PERSONAL] Ledger NO certificado append-only: "+hallazgos.map(h=>h.id).join(", ")+"\n");
  process.stderr.write("Bloqueador de liberación: https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/issues/407\n");
 }else process.stdout.write("[GRUK PERSONAL] No se encontraron estos patrones de mutación; requiere auditoría adicional.\n");
 if(args.includes("--enforce")&&hallazgos.length)process.exitCode=1;
 return hallazgos;
}
if(require.main===module)main();
module.exports={analizarMutacionesLedger,main};
