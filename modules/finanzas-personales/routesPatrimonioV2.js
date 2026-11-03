"use strict";
const express=require("express");
const migracion=require("./services/migracionPatrimonioPersonal.service");
const patrimonio=require("./services/patrimonioCanonico.service");
const router=express.Router();
function falloMigracion(res,e){const status=[400,409,422,503].includes(e?.statusCode)?e.statusCode:500;return res.status(status).json({ok:false,error:status===500?"No fue posible verificar la migración patrimonial; consulta el estado antes de reintentar":"Migración patrimonial pendiente de revisión de fuentes, importes e identidad; originales preservados"});}
router.post("/migracion/patrimonio",async(req,res)=>{try{return res.json({ok:true,reporte:await migracion.migrar(req.personalAuth.userId)});}catch(e){return falloMigracion(res,e);}});
router.get("/migracion/patrimonio/reconciliacion",async(req,res)=>{try{return res.json({ok:true,reporte:await migracion.reconciliar(req.personalAuth.userId)});}catch(e){return falloMigracion(res,e);}});
router.get("/patrimonio-v2",async(req,res)=>{try{return res.json({ok:true,patrimonio:await patrimonio.obtener(req.personalAuth.userId)});}catch(e){return res.status(e.statusCode===409?409:500).json({ok:false,error:e.statusCode===409?"Vista V2 pendiente de verificación; consulta el patrimonio personal actualizado":"No fue posible calcular patrimonio"});}});
module.exports=router;