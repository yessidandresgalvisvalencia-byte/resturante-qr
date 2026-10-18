"use strict";
const {resolverUsuarioAutorizadoV81}=require("./autorizacionV81.service");
const {diagnosticarVinculosHistoricosV81}=require("./diagnosticoVinculosHistoricosV81.service");
function crearConsultaVinculosHistoricosV81(consultar=diagnosticarVinculosHistoricosV81){
 return async(req,res)=>{
  try{
   const usuarioId=resolverUsuarioAutorizadoV81({
    autenticado:req.personalAuth?.verificado===true,usuarioId:req.personalAuth?.userId
   });
   const q=req.query||{};
   if(Object.keys(q).some(k=>k!=="limite"))throw new TypeError("Parámetros inválidos");
   const limite=q.limite===undefined?100:Number(q.limite);
   if(!Number.isSafeInteger(limite)||limite<1||limite>100)throw new TypeError("Límite inválido");
   const resultado=await consultar(usuarioId,{limite});
   return res.set("Cache-Control","no-store").status(200).json({ok:true,diagnostico:resultado});
  }catch(e){
   const status=e.statusCode===401?401:e.statusCode===400||e instanceof TypeError?400:500;
   return res.set("Cache-Control","no-store").status(status).json({
    ok:false,error:status===401?"Autenticación requerida":status===400?"Parámetros inválidos":"Diagnóstico no disponible"
   });
  }
 };
}
module.exports={crearConsultaVinculosHistoricosV81};
