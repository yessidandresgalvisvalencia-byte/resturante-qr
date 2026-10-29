"use strict";
// Los servicios y el campo de respuesta los selecciona el servidor, nunca HTTP.
function crearLecturaPanelPersonal({campo,leer}={}){
 if(!["home","progreso"].includes(campo)||typeof leer!=="function")throw new TypeError("Lectura del panel inválida");
 return async(req,res)=>{
  res.set("Cache-Control","private, no-store, max-age=0");
  const usuarioId=req.personalAuth?.userId;
  if(!usuarioId)return res.status(401).json({ok:false,codigo:"SESION_PERSONAL_REQUERIDA",error:"Sesión personal requerida"});
  try{return res.json({ok:true,[campo]:await leer(usuarioId)});}
  catch(e){
   if(e?.statusCode===422)return res.status(422).json({ok:false,codigo:"LECTURA_PANEL_INCOMPLETA",
    error:"La consulta supera la capacidad verificable. No se calcularon cifras con datos incompletos."});
   return res.status(500).json({ok:false,codigo:"LECTURA_PANEL_NO_DISPONIBLE",
    error:campo==="home"?"No fue posible construir el estado financiero personal":"No fue posible medir el progreso económico"});
  }
 };
}
module.exports={crearLecturaPanelPersonal};
