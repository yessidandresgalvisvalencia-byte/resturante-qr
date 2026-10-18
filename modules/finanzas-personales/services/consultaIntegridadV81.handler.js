"use strict";
const {resolverUsuarioAutorizadoV81}=require("./autorizacionV81.service");
const {verificarLedgerPersistidoV81}=require("./verificacionLedgerV81.service");

function crearConsultaIntegridadV81(verificador=verificarLedgerPersistidoV81) {
 if(typeof verificador!=="function")throw new TypeError("Verificador obligatorio");
 return async function consultarIntegridadV81(req,res) {
  try {
   // personalAuth solo lo fija el middleware tras validar JWT, estado y versión de sesión.
   const usuarioId=resolverUsuarioAutorizadoV81({
    autenticado:req.personalAuth?.verificado===true,
    usuarioId:req.personalAuth?.userId
   });
   const auditoria=await verificador(usuarioId);
   return res.set("Cache-Control","no-store").json({ok:true,auditoria});
  } catch(e) {
   const status=e.statusCode===401?401:500;
   return res.status(status).json({ok:false,error:status===401?"Autenticación requerida":"No fue posible verificar el ledger"});
  }
 };
}
module.exports={crearConsultaIntegridadV81};
