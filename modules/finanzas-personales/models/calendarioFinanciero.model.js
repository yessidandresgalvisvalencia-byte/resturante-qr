"use strict";
const mongoose=require("mongoose");
const schema=new mongoose.Schema({usuarioId:{type:mongoose.Schema.Types.ObjectId,required:true,index:true},tipo:{type:String,enum:["INGRESO","GASTO_FIJO","OBLIGACION"],required:true},concepto:{type:String,required:true,maxlength:140},montoMinor:{type:Number,min:0,default:0},frecuencia:{type:String,enum:["MENSUAL"],default:"MENSUAL"},diaMes:{type:Number,min:1,max:31,required:true},activo:{type:Boolean,default:true},origen:{type:String,enum:["CONVERSACION","SISTEMA","USUARIO"],default:"CONVERSACION"},sourceId:{type:mongoose.Schema.Types.ObjectId,default:null}},{timestamps:true,collection:"fin_calendario_financiero"});
schema.index({usuarioId:1,tipo:1,concepto:1,activo:1});
module.exports=mongoose.models.CalendarioFinanciero||mongoose.model("CalendarioFinanciero",schema);
