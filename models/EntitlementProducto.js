"use strict";
const mongoose=require("mongoose");
const schema=new mongoose.Schema({empresaId:{type:mongoose.Schema.Types.ObjectId,ref:"Empresa",default:null,index:true},usuarioId:{type:mongoose.Schema.Types.ObjectId,required:true,index:true},producto:{type:String,enum:["GRUK_EMPRESARIAL","FINANZAS_PERSONALES"],required:true,index:true},estado:{type:String,enum:["ACTIVO","PRUEBA","VENCIDO","CANCELADO"],required:true,index:true},vigenteDesde:{type:Date,default:Date.now},vigenteHasta:{type:Date,default:null},origen:{type:String,enum:["SUSCRIPCION_EMPRESARIAL","COMPRA_INDEPENDIENTE","ADMIN"],required:true},externalSubscriptionId:{type:String,default:null},version:{type:Number,default:1,min:1}},{timestamps:true,collection:"producto_entitlements"});
schema.index({usuarioId:1,producto:1},{unique:true});
module.exports=mongoose.models.EntitlementProducto||mongoose.model("EntitlementProducto",schema);
