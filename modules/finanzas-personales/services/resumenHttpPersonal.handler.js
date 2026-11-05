"use strict";
function crearResumenHttpPersonal(obtener=(u)=>require("./finanzasPersonales.service").resumen(u)){
 return async(req,res)=>{
  res.set("Cache-Control","private, no-store");
  if(!req.personalAuth?.userId)return res.status(401).json({ok:false,error:"Sesión personal requerida"});
  try{return res.json({ok:true,resumen:await obtener(req.personalAuth.userId)});}
  catch(e){const status=[400,409,422,503].includes(e.statusCode)?e.statusCode:503;return res.status(status).json({ok:false,error:"No fue posible verificar el resumen completo. Actualiza y revisa las fuentes.",codigo:"RESUMEN_PERSONAL_NO_VERIFICABLE"});}
 };
}
function crearConsultaDerivadaPersonal(campo,obtener){
 if(!["plan","analisis","evaluacion"].includes(campo)||typeof obtener!=="function")throw new TypeError("Consulta derivada inválida");
 return async(req,res)=>{
  res.set("Cache-Control","private, no-store");
  if(!req.personalAuth?.userId)return res.status(401).json({ok:false,error:"Sesión personal requerida"});
  try{return res.json({ok:true,[campo]:await obtener(req.personalAuth.userId,req)});}
  catch(e){return res.status([400,409,422,503].includes(e.statusCode)?e.statusCode:503).json({ok:false,error:"No fue posible verificar todos los datos de esta consulta.",codigo:"CONSULTA_DERIVADA_NO_VERIFICABLE"});}
 };
}
module.exports={crearResumenHttpPersonal,crearConsultaDerivadaPersonal};
