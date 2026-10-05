"use strict";
const mongoose=require("mongoose");
const schema=new mongoose.Schema({
 usuarioId:{type:mongoose.Schema.Types.ObjectId,required:true,unique:true,index:true},
 foco:{type:String,enum:["DEUDA","CUENTA_POR_COBRAR","PATRIMONIO","CAJA","NINGUNO"],default:"NINGUNO"},
 entidadId:{type:mongoose.Schema.Types.ObjectId,default:null},
 etiqueta:{type:String,trim:true,maxlength:160,default:""},
 ultimaIntencion:{type:String,trim:true,maxlength:80,default:""},
 ultimaPregunta:{type:String,trim:true,maxlength:500,default:""},
 asOf:{type:Date,default:Date.now}
},{timestamps:true,collection:"fin_contexto_conversacional_personal"});
module.exports=mongoose.models.ContextoConversacionalPersonal||mongoose.model("ContextoConversacionalPersonal",schema);
