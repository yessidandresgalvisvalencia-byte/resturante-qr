"use strict";
const mongoose=require("mongoose");
const schema=new mongoose.Schema({
 usuarioId:{type:mongoose.Schema.Types.ObjectId,required:true,index:true},
 compromisoId:{type:mongoose.Schema.Types.ObjectId,ref:"CompromisoCuotasPersonal",required:true,index:true},
 numero:{type:Number,required:true,min:1,max:360},
 montoMinor:{type:Number,required:true,min:1,validate:Number.isSafeInteger},
 estado:{type:String,enum:["PENDIENTE","PAGADA"],default:"PENDIENTE",index:true},
 pagadaEn:{type:Date,default:null},
 transaccionId:{type:mongoose.Schema.Types.ObjectId,ref:"TransaccionPersonal",default:null}
},{timestamps:true,collection:"fin_compromisos_cuotas_hijas"});
schema.index({usuarioId:1,compromisoId:1,numero:1},{unique:true});
module.exports=mongoose.models.CuotaHijaPersonal||mongoose.model("CuotaHijaPersonal",schema);
