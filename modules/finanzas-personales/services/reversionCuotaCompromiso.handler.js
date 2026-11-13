"use strict";
const {deshacer}=require("./compromisosCuotas.service");
function crearReversionCuota({aplicar=deshacer}={}){
 return async(req,res)=>{
  res.set("Cache-Control","private, no-store, max-age=0");
  const usuarioId=req.personalAuth?.userId;
  if(!usuarioId)return res.status(401).json({ok:false,error:"Autenticación requerida"});
  const id=req.params.id,numero=req.params.numero,movimientoId=req.body?.movimientoId;
  const idempotencyKey=req.get("Idempotency-Key");
  if(!/^[a-f0-9]{24}$/i.test(id||"")||!/^[1-9][0-9]{0,2}$/.test(numero||"")||Number(numero)>360||
   typeof movimientoId!=="string"||!/^[a-f0-9]{24}$/i.test(movimientoId)||
   typeof idempotencyKey!=="string"||!/^[A-Za-z0-9_-]{1,128}$/.test(idempotencyKey))
   return res.status(400).json({ok:false,error:"Cuota, movimiento y clave idempotente válidos requeridos"});
  try{
   const resultado=await aplicar(usuarioId,{compromisoId:id.toLowerCase(),numero:Number(numero),movimientoId:movimientoId.toLowerCase(),idempotencyKey});
   return res.json({ok:true,resultado});
  }catch(e){
   const status=e.code===11000?409:[400,404,409,422,503].includes(e.statusCode)?e.statusCode:500;
   return res.status(status).json({ok:false,error:status===500?"No se pudo revertir la cuota":e.code===11000?"Operación concurrente; consulta antes de reintentar":e.message});
  }
 };
}
module.exports={crearReversionCuota};
