"use strict";
const express=require("express");
const mongoose=require("mongoose");
const auth=require("../core/auth/auth.middleware");
const {ROLES_GRUK,roleCheck}=require("../core/auth/roleCheck.middleware");
const Decision=require("../intelligence/models/CerebroDecision");
const Auditoria=require("../intelligence/models/CerebroAuditoria");
const router=express.Router();
const seguridad=[auth,roleCheck(ROLES_GRUK.DUENO,ROLES_GRUK.ADMIN_SEDE)];
router.get("/ultima-decision",...seguridad,async(req,res)=>{
 try{const decision=await Decision.findOne({empresaId:req.auth.empresaId,deletedAt:null}).sort({createdAt:-1}).lean();return res.json({ok:true,decision:decision||null});}
 catch(e){console.error("Cerebro ultima decision:",e);return res.status(500).json({ok:false,error:"Error consultando decision del Cerebro"});}
});
router.post("/decisiones/:decisionId/ordenes/:ordenId/aprobar",...seguridad,async(req,res)=>{
 try{
  if(!mongoose.Types.ObjectId.isValid(req.params.decisionId)||!mongoose.Types.ObjectId.isValid(req.params.ordenId))return res.status(400).json({ok:false,error:"Identificador invalido"});
  const decision=await Decision.findOne({ _id:req.params.decisionId,empresaId:req.auth.empresaId,deletedAt:null});
  if(!decision)return res.status(404).json({ok:false,error:"Decision no encontrada"});
  const orden=decision.ordenes_por_departamento.id(req.params.ordenId); if(!orden)return res.status(404).json({ok:false,error:"Orden no encontrada"});
  if(orden.estado!=="PENDIENTE_APROBACION")return res.status(409).json({ok:false,error:"La orden ya fue procesada"});
  orden.estado="APROBADA";orden.aprobadaPor=req.auth.usuarioId;orden.aprobadaAt=new Date();await decision.save();
  await Auditoria.create({empresaId:req.auth.empresaId,sedeId:req.auth.sedeId||null,decisionId:decision._id,ordenId:orden._id,accion:"APROBAR",usuarioId:req.auth.usuarioId,metadata:{rol:req.auth.rol}});
  return res.json({ok:true,orden});
 }catch(e){console.error("Cerebro aprobar orden:",e);return res.status(500).json({ok:false,error:"Error aprobando orden"});}
});
module.exports=router;
