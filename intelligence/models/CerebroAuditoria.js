"use strict";
const mongoose=require("mongoose");
const schema=new mongoose.Schema({empresaId:{type:mongoose.Schema.Types.ObjectId,ref:"Empresa",required:true,index:true},sedeId:{type:mongoose.Schema.Types.ObjectId,ref:"Sede",default:null,index:true},decisionId:{type:mongoose.Schema.Types.ObjectId,ref:"CerebroDecision",required:true,index:true},ordenId:{type:mongoose.Schema.Types.ObjectId,required:true},accion:{type:String,required:true,enum:["APROBAR","RECHAZAR"]},usuarioId:{type:mongoose.Schema.Types.ObjectId,ref:"Usuario",required:true},metadata:{type:mongoose.Schema.Types.Mixed,default:{}}},{timestamps:true,collection:"cerebro_auditoria"});
module.exports=mongoose.models.CerebroAuditoria||mongoose.model("CerebroAuditoria",schema);
