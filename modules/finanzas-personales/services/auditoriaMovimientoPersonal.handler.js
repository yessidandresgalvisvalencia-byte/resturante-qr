"use strict";
const S=require("./auditoriaMovimientoPersonal.service");
function crearHandler({consultar=S.consultar}={}){return async(req,res)=>{
 res.set("Cache-Control","private, no-store, max-age=0");
 if(!req.personalAuth?.userId)return res.status(401).json({ok:false,error:"Sesión personal requerida"});
 try{return res.json({ok:true,...await consultar(req.personalAuth.userId,req.params.id,req.query)});}
 catch(e){const status=[400,404,409,422,503].includes(e.statusCode)?e.statusCode:/INTEGRIDAD_LEDGER/.test(e.message||"")?409:500;return res.status(status).json({ok:false,error:status===500?"No fue posible consultar la auditoría del movimiento":status===409?"La auditoría cambió o no es verificable; actualiza y revisa la fuente":e.message});}
};}
module.exports={crearHandler};
