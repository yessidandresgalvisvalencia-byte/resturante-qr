"use strict";
const mongoose=require("mongoose");
const schema=new mongoose.Schema({userId:{type:mongoose.Schema.Types.ObjectId,required:true,index:true},tokenHash:{type:String,required:true,unique:true,index:true},expiraEn:{type:Date,required:true,index:{expires:0}},usadoEn:{type:Date,default:null}},{timestamps:true,collection:"fin_reset_tokens_personales"});
module.exports=mongoose.models.FinResetTokenPersonal||mongoose.model("FinResetTokenPersonal",schema);