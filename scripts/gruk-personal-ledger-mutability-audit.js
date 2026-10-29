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
const MODELOS=["TransaccionPersonal","EventoCompensatorioPersonal","decisionProofPersonal.model","eventoV81.model","vinculoHistoricoV81.model"];
const METODOS="updateOne|updateMany|findOneAndUpdate|findByIdAndUpdate|replaceOne|findOneAndReplace|deleteOne|deleteMany|findOneAndDelete|findByIdAndDelete|bulkWrite";
const escapar=s=>s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
function analizarAccesosModelos(codigo){
 const nombres=MODELOS.map(escapar).join("|");
 const cargar=String.raw`require\s*\(\s*["'][^"']*/models/(?:${nombres})(?:\.js)?["']\s*\)`;
 const aliases=new Set([...codigo.matchAll(new RegExp(String.raw`\b([A-Za-z_$][\w$]*)\s*=\s*${cargar}`,"g"))].map(m=>m[1]));
 const hallazgos=[];
 const registrar=re=>{for(const m of codigo.matchAll(re))hallazgos.push({id:"MUTACION_MODELO_PROTEGIDO",
  descripcion:"candidato de modificación sobre modelo protegido; requiere revisión",linea:codigo.slice(0,m.index).split("\n").length});};
 const operacion=String.raw`\s*\.\s*(?:${METODOS})\s*\(`;
 for(const alias of aliases)registrar(new RegExp(String.raw`\b${escapar(alias)}(?:\s*\.\s*collection)?${operacion}`,"g"));
 registrar(new RegExp(String.raw`${cargar}(?:\s*\.\s*collection)?${operacion}`,"g"));
 const colecciones="fin_transacciones_personales|fin_eventos_compensatorios_personales_v1|decisionproofpersonals|fin_eventos_v81|fin_vinculos_historicos_v81";
 registrar(new RegExp(String.raw`\.\s*collection\s*\(\s*["'](?:${colecciones})["']\s*\)${operacion}`,"g"));
 return [...new Map(hallazgos.map(h=>[h.id+":"+h.linea,h])).values()];
}
function archivosJavascript(directorio,prefijo=""){
 return fs.readdirSync(directorio,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e=>{
  const relativo=prefijo+e.name;
  if(e.isDirectory())return archivosJavascript(path.join(directorio,e.name),relativo+"/");
  return e.isFile()&&e.name.endsWith(".js")?[relativo]:[];
 });
}
function auditarProyecto(raiz=path.resolve(__dirname,"..")){
 const base=path.join(raiz,"modules/finanzas-personales");
 const heredados=new Set(["services/flujoCajaPersonal.service.js","routes.js",
  "services/patrimonioPersonal.service.js","services/compromisosCuotas.service.js","services/migracionLedgerPersonal.service.js"]);
 const externos=fs.readdirSync(raiz,{withFileTypes:true})
  .filter(e=>e.isFile()&&e.name.endsWith(".js")).map(e=>e.name);
 for(const carpeta of ["scripts","routes","controllers"]){
  const directorio=path.join(raiz,carpeta);
  if(fs.existsSync(directorio)&&fs.statSync(directorio).isDirectory())
   externos.push(...archivosJavascript(directorio).map(a=>carpeta+"/"+a));
 }
 const revisar=(archivo,codigo,esPersonal)=>{
  const mutaciones=esPersonal&&heredados.has(archivo)?analizarMutacionesLedger(codigo).filter(h=>archivo.startsWith("services/flujoCaja")||
   ["ANULACION_ESTADO","SAVE_ANULACION"].includes(h.id)):[];
  return [...mutaciones,...analizarAccesosModelos(codigo)].map(h=>({archivo,...h}));
 };
 return [...archivosJavascript(base).flatMap(archivo=>revisar(archivo,fs.readFileSync(path.join(base,archivo),"utf8"),true)),
  ...externos.sort().flatMap(archivo=>revisar(archivo,fs.readFileSync(path.join(raiz,archivo),"utf8"),false))];
}
function main(args=process.argv.slice(2)){
 const hallazgos=auditarProyecto();
 if(hallazgos.length){
  process.stderr.write("[GRUK PERSONAL] Ledger NO certificado append-only: "+hallazgos.map(h=>h.archivo+":"+h.id).join(", ")+"\n");
  process.stderr.write("Bloqueador de liberación: https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/issues/407\n");
 }else{
  process.stdout.write("[GRUK PERSONAL] No se encontraron estos patrones de mutación en los archivos revisados.\n");
  process.stderr.write("[GRUK PERSONAL] Ledger NO certificado append-only: faltan evidencias de permisos MongoDB, anclajes independientes y cobertura completa de escrituras.\n");
  process.stderr.write("Bloqueador de liberación: https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/issues/407\n");
 }
 // Una búsqueda de patrones vacía no acredita los requisitos externos de #407.
 if(args.includes("--enforce"))process.exitCode=1;
 return hallazgos;
}
if(require.main===module)main();
module.exports={analizarMutacionesLedger,analizarAccesosModelos,archivosJavascript,auditarProyecto,main};
