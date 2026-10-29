"use strict";
const {crearAplicador}=require("./compensarMovimientoPersonal.service");
function crearHandler({tipo,aplicar=crearAplicador()}={}){
 if(!["CORRECCION","ANULACION"].includes(tipo))throw new TypeError("Operación inválida");
 return async(req,res)=>{
  res.set("Cache-Control","private, no-store");
  const usuarioId=req.personalAuth?.userId;
  if(!usuarioId)return res.status(401).json({ok:false,error:"Sesión personal requerida"});
  const idempotencyKey=req.headers?.["idempotency-key"];
  if(typeof idempotencyKey!=="string"||!/^[A-Za-z0-9_-]{1,128}$/.test(idempotencyKey))
   return res.status(400).json({ok:false,error:"Clave de operación obligatoria; reintenta desde el movimiento"});
  try{
   const evento=await aplicar({usuarioId,movimientoId:req.params.id,tipo,
    cambios:tipo==="CORRECCION"?req.validated:{},idempotencyKey});
   const {usuarioId:_,movimientoId:__,...original}=evento.original;
   return res.json({ok:true,compensacion:evento,transaccion:{_id:evento.movimientoId,
    ...original,...evento.cambios,estado:tipo==="ANULACION"?"ANULADA":"ACTIVA"}});
  }catch(e){
   const status=e.code===11000?409:e.statusCode||(e instanceof TypeError||e instanceof RangeError?400:500);
   return res.status(status).json({ok:false,error:status===500?"No fue posible confirmar la compensación":
    e.code===11000?"Conflicto de operación; reintenta con la misma clave":e.message});
  }
 };
}
module.exports={crearHandler};
