"use strict";
const {resolverUsuarioAutorizadoV81}=require("./autorizacionV81.service");
const {consultarSaldoVerificadoV81}=require("./consultaSaldoVerificadoV81.service");
function crearConsultaSaldoV81(consultar=consultarSaldoVerificadoV81){
 return async(req,res)=>{
  try{
   const usuarioId=resolverUsuarioAutorizadoV81({autenticado:req.personalAuth?.verificado===true,usuarioId:req.personalAuth?.userId});
   const resultado=await consultar(usuarioId);
   return res.set("Cache-Control","no-store").status(resultado.integridad==="VERIFICADA"?200:409).json({ok:resultado.integridad==="VERIFICADA",...resultado});
  }catch(e){const status=e.statusCode===401?401:500;return res.status(status).json({ok:false,error:status===401?"Autenticación requerida":"Saldo no disponible"});}
 };
}
module.exports={crearConsultaSaldoV81};
