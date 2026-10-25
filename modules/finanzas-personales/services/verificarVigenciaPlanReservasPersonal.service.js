"use strict";
// Compara un diagnóstico antiguo contra uno recalculado, sin autorizar
// escrituras. La huella SHA256 NO es una firma ni prueba autenticidad.
const {timingSafeEqual}=require("node:crypto");
const {planearReparacionReservas}=require("./planReparacionReservasPersonal.service");
const HEX=/^[a-f0-9]{64}$/;
function fallo(mensaje,statusCode=409){
 throw Object.assign(new Error("VIGENCIA_PLAN_RESERVAS: "+mensaje),{statusCode});
}
function verificarVigenciaPlanReservas({
 usuarioId,origenId,huellaEsperada,auditoriaActual
}){
 if(typeof huellaEsperada!=="string"||!HEX.test(huellaEsperada))
  fallo("huella de diagnóstico inválida",400);
 const vigente=planearReparacionReservas({
  usuarioId,origenId,auditoria:auditoriaActual
 });
 const correcta=timingSafeEqual(
  Buffer.from(huellaEsperada,"hex"),
  Buffer.from(vigente.huellaDiagnostico,"hex")
 );
 if(!correcta)fallo("diagnóstico desactualizado: requiere nueva auditoría");
 if(vigente.estado==="SIN_DIFERENCIAS")
  fallo("no existen diferencias para reparar");
 if(vigente.acciones.some(a=>a.propuesta==="REVISION_MANUAL"))
  fallo("el diagnóstico contiene anomalías que requieren revisión manual");
 return Object.freeze({
  vigente:true,huellaDiagnostico:vigente.huellaDiagnostico,
  cambiosSugeridos:vigente.acciones.length,
  autorizaEscritura:false,requiereControlConcurrenteDeEscritura:true,
  aptoParaDisponibleHoy:false
 });
}
module.exports={verificarVigenciaPlanReservas};
