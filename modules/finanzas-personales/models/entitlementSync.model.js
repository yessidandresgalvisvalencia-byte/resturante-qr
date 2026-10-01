"use strict";
const mongoose=require("mongoose");
const schema=new mongoose.Schema({eventId:{type:String,required:true,unique:true,index:true},sourceUsuarioId:{type:String,required:true,index:true},sourceEmpresaId:{type:String,default:null,index:true},producto:{type:String,enum:["FINANZAS_PERSONALES"],required:true},estado:{type:String,enum:["ACTIVO","PRUEBA","VENCIDO","CANCELADO"],required:true},vigenteHasta:{type:Date,default:null},recibidoEn:{type:Date,default:Date.now}},{timestamps:true,collection:"fin_entitlement_sync"});
module.exports=mongoose.models.FinEntitlementSync||mongoose.model("FinEntitlementSync",schema);
