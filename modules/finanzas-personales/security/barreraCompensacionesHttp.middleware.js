"use strict";
// Fail closed: esta ruta nueva ajusta saldo y outbox, pero el panel heredado
// todavía no proyecta siempre el ledger compensatorio. No publicarla
// accidentalmente por fusionar el PR o recuperar builds de Render.
function crearBarreraCompensacionesHttp({habilitada=()=>process.env.GRUK_FP_COMPENSACIONES_HTTP_ENABLED==="true"}={}){
 if(typeof habilitada!=="function")throw new TypeError("Política de habilitación inválida");
 return function barrera(req,res,next){
  if(habilitada()!==true)
   return res.status(503).json({ok:false,
    error:"Compensaciones no habilitadas hasta unificar las proyecciones financieras",
    codigo:"FP_COMPENSACIONES_NO_HABILITADAS"});
  return next();
 };
}
module.exports={crearBarreraCompensacionesHttp};
