"use strict";
const {spawnSync}=require("node:child_process");
const SERVICE_ID="srv-dav8md7pn0mc739khig0";
// Solamente Render de Finanzas Personales ejecuta esta puerta en postinstall.
// CI dispone de sus propios jobs; otros servicios del monorepo no se alteran.
if(process.env.RENDER_SERVICE_ID!==SERVICE_ID){
 console.log("[GRUK_FP_BUILD_GATE] OMITIDO_SERVICIO_AJENO");
 process.exit(0);
}
const npm=process.platform==="win32"?"npm.cmd":"npm";
for(const script of ["check:personal","test:finanzas-personales"]){
 console.log("[GRUK_FP_BUILD_GATE] EJECUTANDO",script);
 const r=spawnSync(npm,["run",script],{
  cwd:process.cwd(),stdio:"inherit",env:process.env,timeout:180000
 });
 if(r.error||r.status!==0){
  console.error("[GRUK_FP_BUILD_GATE] BLOQUEADO",script,
   r.error?.code||r.signal||r.status);
  process.exit(1);
 }
}
console.log("[GRUK_FP_BUILD_GATE] PRUEBAS_APROBADAS_SIN_MONGO_EXTERNO");
