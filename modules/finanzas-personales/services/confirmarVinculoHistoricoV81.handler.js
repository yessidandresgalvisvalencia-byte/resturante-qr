"use strict";
const {resolverUsuarioAutorizadoV81}=require("./autorizacionV81.service");
const {confirmarVinculoHistoricoV81}=require("./confirmarVinculoHistoricoV81.service");
function crearConfirmacionVinculoHistoricoV81(confirmar=confirmarVinculoHistoricoV81){
 return async(req,res)=>{
  try{
   const usuarioId=resolverUsuarioAutorizadoV81({
    autenticado:req.personalAuth?.verificado===true,usuarioId:req.personalAuth?.userId
   });
   const resultado=await confirmar(usuarioId,req.validated);
   return res.set("Cache-Control","no-store").status(resultado.yaExistia?200:201).json({ok:true,...resultado});
  }catch(e){
   const status=[400,401,404,409,503].includes(e.statusCode)?e.statusCode:500;
   const error=status===500?"No fue posible confirmar el vínculo":status===503?"Confirmación no verificada. Reintenta con la misma clave de idempotencia.":e.message;
   return res.set("Cache-Control","no-store").status(status).json({ok:false,error});
  }
 };
}
module.exports={crearConfirmacionVinculoHistoricoV81};
