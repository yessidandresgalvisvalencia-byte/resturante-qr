"use strict";
const mongoose=require("mongoose");
const schema=new mongoose.Schema({userId:{type:mongoose.Schema.Types.ObjectId,required:true,unique:true,index:true},moneda:{type:String,default:"COP",uppercase:true,trim:true},fondoEmergenciaObjetivoMeses:{type:Number,default:6,min:1,max:24},ahorroObjetivoPct:{type:Number,default:10,min:0,max:100},saldoLiquido:{type:Number,default:0,min:0}},{timestamps:true,collection:"fin_personas"});
module.exports=mongoose.models.FinPerfil||mongoose.model("FinPerfil",schema);