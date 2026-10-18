"use strict";
const Suscripcion=require("../models/suscripcion.model");
// Etapa gratuita: se conserva la autenticación y no se altera la suscripción histórica.
module.exports=async function entitlement(req,res,next){
 try{
  const s=await Suscripcion.findOne({userId:req.personalAuth.userId}).lean();
  req.finanzasPersonalesSuscripcion=s;
  req.finanzasPersonalesAcceso=Object.freeze({modo:"GRATIS",cobroRequerido:false});
  return next();
 }catch(e){
  console.error("[FIN_PERSONAL_ENTITLEMENT]",e);
  return res.status(500).json({ok:false,error:"No fue posible validar el acceso"});
 }
};
