"use strict";
const mongoose=require("mongoose");
const schema=new mongoose.Schema({
 consumidor:{type:String,required:true,maxlength:120,index:true},
 eventId:{type:String,required:true,maxlength:120,index:true},
 eventName:{type:String,required:true,maxlength:120},
 usuarioId:{type:mongoose.Schema.Types.ObjectId,required:true,index:true},
 procesadoEn:{type:Date,default:Date.now,immutable:true}
},{timestamps:false,collection:"fin_eventos_procesados_personal"});
schema.index({consumidor:1,eventId:1},{unique:true});
module.exports=mongoose.models.EventoProcesadoPersonal||mongoose.model("EventoProcesadoPersonal",schema);
