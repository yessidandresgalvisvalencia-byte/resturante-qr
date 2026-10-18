"use strict";
const mongoose=require("mongoose");
const schema=new mongoose.Schema({userId:{type:mongoose.Schema.Types.ObjectId,required:true,index:true},nombre:{type:String,required:true,trim:true,maxlength:120},objetivo:{type:Number,required:true,min:0},acumulado:{type:Number,default:0,min:0},fechaObjetivo:{type:Date,default:null},estado:{type:String,enum:["ACTIVA","CUMPLIDA","PAUSADA"],default:"ACTIVA",index:true}},{timestamps:true,collection:"fin_metas"});
schema.index({userId:1,estado:1});
module.exports=mongoose.models.FinMeta||mongoose.model("FinMeta",schema);