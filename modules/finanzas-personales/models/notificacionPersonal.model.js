"use strict";
const mongoose=require("mongoose");
const schema=new mongoose.Schema({
 usuarioId:{type:mongoose.Schema.Types.ObjectId,required:true,index:true},
 clave:{type:String,required:true,maxlength:220},
 tipo:{type:String,enum:["RECORDATORIO_COBRO"],required:true,index:true},
 titulo:{type:String,required:true,maxlength:160},
 mensaje:{type:String,required:true,maxlength:300},
 payload:{type:mongoose.Schema.Types.Mixed,default:{}},
 leidaEn:{type:Date,default:null,index:true}
},{timestamps:true,collection:"fin_notificaciones_personales"});
schema.index({usuarioId:1,clave:1},{unique:true});
schema.index({usuarioId:1,leidaEn:1,createdAt:-1});
module.exports=mongoose.models.NotificacionPersonal||mongoose.model("NotificacionPersonal",schema);
