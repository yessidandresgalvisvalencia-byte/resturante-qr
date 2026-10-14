"use strict";
const mongoose=require("mongoose");
const schema=new mongoose.Schema({
 usuarioId:{type:mongoose.Schema.Types.ObjectId,required:true,index:true},
 concepto:{type:String,required:true,trim:true,maxlength:140},
 categoria:{type:String,required:true,trim:true,maxlength:80},
 montoTotalMinor:{type:Number,required:true,min:1,validate:Number.isSafeInteger},
 saldoMinor:{type:Number,required:true,min:0,validate:Number.isSafeInteger},
 numeroCuotas:{type:Number,required:true,min:1,max:360},
 cuotasPagadas:{type:Number,default:0,min:0},
 estado:{type:String,enum:["ACTIVA","FINALIZADA"],default:"ACTIVA",index:true},
 modalidadContable:{type:String,enum:["COMPRA_FINANCIADA"],default:"COMPRA_FINANCIADA"}
},{timestamps:true,collection:"fin_compromisos_cuotas"});
schema.index({usuarioId:1,estado:1,createdAt:-1});
module.exports=mongoose.models.CompromisoCuotasPersonal||mongoose.model("CompromisoCuotasPersonal",schema);
