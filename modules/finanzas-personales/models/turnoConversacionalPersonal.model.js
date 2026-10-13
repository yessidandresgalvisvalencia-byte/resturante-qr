"use strict";
const mongoose=require("mongoose");
const schema=new mongoose.Schema({
 usuarioId:{type:mongoose.Schema.Types.ObjectId,required:true,index:true},
 mensaje:{type:String,required:true,trim:true,maxlength:5000},
 respuesta:{type:String,required:true,maxlength:10000},
 clase:{type:String,enum:["PREGUNTA","INTENCION","HECHO","VALIDACION"],required:true},
 requiereAprobacion:{type:Boolean,default:false}
},{timestamps:true,collection:"fin_turnos_conversacionales_personales"});
schema.index({usuarioId:1,createdAt:-1});
module.exports=mongoose.models.TurnoConversacionalPersonal||mongoose.model("TurnoConversacionalPersonal",schema);
