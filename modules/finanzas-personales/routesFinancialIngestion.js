"use strict";
const express=require("express");
const Joi=require("joi");
const ingestion=require("./services/financialIngestion.service");
const router=express.Router();
const schema=Joi.object({
 fuente:Joi.string().valid("GMAIL","BANCO_API","EXTRACTO","ANDROID").required(),
 cuentaFuente:Joi.string().trim().min(1).max(160).required(),
 referenciaExterna:Joi.string().trim().min(1).max(300).required(),
 fechaMovimiento:Joi.date().iso().required(),
 montoMinor:Joi.number().integer().positive().max(Number.MAX_SAFE_INTEGER).required(),
 direccion:Joi.string().valid("ENTRADA","SALIDA").required(),
 moneda:Joi.string().valid("COP").required(),
 evidencia:Joi.string().valid("NOTIFICACION","EXTRACTO","API_BANCARIA").required(),
 contraparte:Joi.string().max(160).allow(""),
 descripcion:Joi.string().max(500).allow("")
}).required();
router.get("/ingestion/pendientes",async(req,res)=>{
 try{return res.json({ok:true,movimientos:await ingestion.pendientes(req.personalAuth.userId)});}
 catch(e){console.error("[PERSONAL_INGESTION_LIST]",e);return res.status(500).json({ok:false,error:"No fue posible consultar movimientos"});}
});
router.post("/ingestion/movimientos",async(req,res)=>{
 const {value,error}=schema.validate(req.body,{abortEarly:false,stripUnknown:true});
 if(error)return res.status(400).json({ok:false,error:"Datos inválidos"});
 try{
  const resultado=await ingestion.registrarMovimiento(req.personalAuth.userId,value);
  return res.status(resultado.duplicado?200:201).json({ok:true,duplicado:resultado.duplicado,movimiento:resultado.movimiento});
 }catch(e){if(!e.statusCode)console.error("[PERSONAL_INGESTION]",e);return res.status(e.statusCode||500).json({ok:false,error:e.statusCode?e.message:"No fue posible registrar el movimiento"});}
});
module.exports=router;
