"use strict";
const mongoose=require("mongoose");
const schema=new mongoose.Schema({userId:{type:mongoose.Schema.Types.ObjectId,required:true,index:true},nombre:{type:String,required:true,trim:true,maxlength:100},saldo:{type:Number,required:true,min:0},tasaMensualPct:{type:Number,required:true,min:0,max:100},cuotaMensual:{type:Number,required:true,min:0},mesesRestantes:{type:Number,required:true,min:0,max:600},activo:{type:Boolean,default:true,index:true}},{timestamps:true,collection:"fin_creditos"});
module.exports=mongoose.models.FinCredito||mongoose.model("FinCredito",schema);