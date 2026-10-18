"use strict";
const express=require("express");
const migracion=require("./services/migracionPatrimonioPersonal.service");
const patrimonio=require("./services/patrimonioCanonico.service");
const router=express.Router();
router.post("/migracion/patrimonio",async(req,res)=>{try{return res.json({ok:true,reporte:await migracion.migrar(req.personalAuth.userId)});}catch(e){console.error("[FIN_PERSONAL_MIGRACION_PATRIMONIO]",e);return res.status(500).json({ok:false,error:"Migración patrimonial no completada; legacy preservado"});}});
router.get("/migracion/patrimonio/reconciliacion",async(req,res)=>{try{return res.json({ok:true,reporte:await migracion.reconciliar(req.personalAuth.userId)});}catch(e){return res.status(500).json({ok:false,error:"No fue posible reconciliar patrimonio"});}});
router.get("/patrimonio-v2",async(req,res)=>{try{return res.json({ok:true,patrimonio:await patrimonio.obtener(req.personalAuth.userId)});}catch(e){return res.status(500).json({ok:false,error:"No fue posible calcular patrimonio"});}});
module.exports=router;