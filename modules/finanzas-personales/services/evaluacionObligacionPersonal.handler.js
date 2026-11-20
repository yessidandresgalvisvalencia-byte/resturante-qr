"use strict";
const {evaluar,validarEntrada}=require("./obligacionesPersonal.service");
function crearHandler({evaluarObligacion=evaluar}={}){return async(req,res)=>{
 res.set("Cache-Control","no-store");try{validarEntrada(req.body);const evaluacion=await evaluarObligacion(req.personalAuth.userId,req.body);return res.json({ok:true,evaluacion});}
 catch(e){return res.status(e.statusCode||503).json({ok:false,error:e.statusCode?e.message:"No fue posible verificar la obligación; no hay recomendación disponible."});}
};}
module.exports={crearHandler};
