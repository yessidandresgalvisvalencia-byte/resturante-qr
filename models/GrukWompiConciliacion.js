"use strict";
const mongoose=require("mongoose");
const schema=new mongoose.Schema({
 reference:{type:String,required:true,immutable:true},
 transactionId:{type:String,required:true,immutable:true},
 reason:{type:String,required:true,maxlength:100},
 estado:{type:String,enum:["PENDIENTE","RESUELTO"],default:"PENDIENTE"},
 ultimoIntentoAt:{type:Date,default:Date.now},
 intentos:{type:Number,default:1,min:1},
 resueltoAt:{type:Date,default:null}
},{collection:"gruk_wompi_conciliaciones",timestamps:true,strict:"throw"});
schema.index({reference:1,transactionId:1},{unique:true,name:"uq_wompi_conciliacion"});
schema.index({estado:1,ultimoIntentoAt:1});
module.exports=mongoose.models.GrukWompiConciliacion||mongoose.model("GrukWompiConciliacion",schema);
