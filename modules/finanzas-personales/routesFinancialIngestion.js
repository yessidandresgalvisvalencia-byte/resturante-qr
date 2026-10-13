"use strict";
const express=require("express");
const ingestion=require("./services/financialIngestion.service");
const router=express.Router();
router.get("/ingestion/pendientes",async(req,res)=>{
 try{return res.json({ok:true,movimientos:await ingestion.pendientes(req.personalAuth.userId)});}
 catch(e){console.error("[PERSONAL_INGESTION_LIST]",e);return res.status(500).json({ok:false,error:"No fue posible consultar movimientos"});}
});
router.post("/ingestion/movimientos",(_req,res)=>res.status(403).json({ok:false,error:"Ingestión directa deshabilitada hasta verificar la identidad del proveedor"}));
module.exports=router;
