"use strict";
const {deshacer}=require("./reversionCuotaCreditoPersonal.service");
function crearReversionCuotaCredito({aplicar=deshacer}={}){
 return async(req,res)=>{
  res.set("Cache-Control","private, no-store, max-age=0");
  const usuarioId=req.personalAuth?.userId,id=req.params.id,movimientoId=req.body?.movimientoId;
  if(!usuarioId)return res.status(401).json({ok:false,error:"Autenticación requerida"});
  const idempotencyKey=req.get("Idempotency-Key");
  if(typeof id!=="string"||!/^[a-f0-9]{24}$/i.test(id)||typeof movimientoId!=="string"||!/^[a-f0-9]{24}$/i.test(movimientoId)||
   typeof idempotencyKey!=="string"||!/^[A-Za-z0-9_-]{1,128}$/.test(idempotencyKey))
   return res.status(400).json({ok:false,error:"Préstamo, pago y clave idempotente válidos requeridos"});
  try{return res.json({ok:true,resultado:await aplicar(usuarioId,id.toLowerCase(),{movimientoId:movimientoId.toLowerCase(),idempotencyKey})});}
  catch(e){const status=[400,404,409,422,503].includes(e.statusCode)?e.statusCode:500;
   return res.status(status).json({ok:false,error:status===500?"No se pudo revertir la cuota":e.message});}
 };
}
module.exports={crearReversionCuotaCredito};
