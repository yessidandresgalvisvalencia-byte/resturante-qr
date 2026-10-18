"use strict";
// Inventario no destructivo: npm ci normalmente solo informa el número de
// vulnerabilidades. Este preflight deja identificadores concretos en logs de
// compilación, sin revelar tokens ni alterar package-lock.json.
const {spawnSync}=require("node:child_process");
const {execPath}=process;
const npm=process.platform==="win32"?"npm.cmd":"npm";
if(process.env.GRUK_SKIP_INSTALL_AUDIT==="1")process.exit(0);
try{
 const resultado=spawnSync(npm,["audit","--json","--audit-level=high"],{
  cwd:process.cwd(),encoding:"utf8",timeout:20000,maxBuffer:3*1024*1024,
  env:{...process.env,NPM_CONFIG_FUND:"false"}
 });
 if(resultado.error)throw resultado.error;
 let informe;
 try{informe=JSON.parse(resultado.stdout||"");}
 catch(_){throw new Error("Informe npm audit no disponible");}
 const vulnerabilidades=informe.vulnerabilities;
 if(!vulnerabilidades||typeof vulnerabilidades!=="object")throw new Error("Informe incompleto");
 const detalles=Object.entries(vulnerabilidades)
  .filter(([,v])=>v&&["high","critical"].includes(v.severity))
  .map(([nombre,v])=>({
   paquete:nombre,severidad:v.severity,rango:typeof v.range==="string"?v.range:"NO_INFORMADO",
   solucion:v.fixAvailable===false?"REVISION_MANUAL":
    typeof v.fixAvailable==="object"?"ACTUALIZAR_"+String(v.fixAvailable.name||nombre)+"_"+String(v.fixAvailable.version||""):
    "CORRECCION_DISPONIBLE"
  }));
 const resumen=informe.metadata?.vulnerabilities;
 console.log("[GRUK_AUDITORIA_NPM_INSTALACION]",JSON.stringify({
  integridad:resumen&&Number(resumen.high||0)===detalles.filter(v=>v.severidad==="high").length&&
   Number(resumen.critical||0)===detalles.filter(v=>v.severidad==="critical").length?
   "CONSISTENTE":"REVISION_REQUERIDA",
  altas:detalles.filter(v=>v.severidad==="high").length,
  criticas:detalles.filter(v=>v.severidad==="critical").length,
  detalles
 }));
}catch(error){
 console.warn("[GRUK_AUDITORIA_NPM_INSTALACION] SIN_EVIDENCIA",
  String(error.message||error).replace(/[\r\n]/g," ").slice(0,160));
}
// No se usa como puerta de despliegue: la auditoría obligatoria está en CI.
