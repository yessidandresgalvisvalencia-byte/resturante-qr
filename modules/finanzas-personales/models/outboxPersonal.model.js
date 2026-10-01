"use strict";
const mongoose=require("mongoose");
const schema=new mongoose.Schema({
 usuarioId:{type:mongoose.Schema.Types.ObjectId,required:true,index:true},
 eventId:{type:String,required:true,unique:true,index:true},
 eventName:{type:String,enum:["GASTO_REGISTRADO","INGRESO_DETECTADO","PAGO_DEUDA","MOVIMIENTO_PATRIMONIAL"],required:true,index:true},
 aggregateType:{type:String,default:"TRANSACCION_PERSONAL"},
 aggregateId:{type:mongoose.Schema.Types.ObjectId,required:true},
 payload:{type:mongoose.Schema.Types.Mixed,required:true},
 estado:{type:String,enum:["PENDIENTE","PUBLICADO","ERROR"],default:"PENDIENTE",index:true},
 intentos:{type:Number,default:0,min:0},publicadoEn:{type:Date,default:null},ultimoError:{type:String,default:null,maxlength:500}
},{timestamps:true,collection:"fin_outbox_personal"});
schema.index({estado:1,createdAt:1});
module.exports=mongoose.models.FinOutboxPersonal||mongoose.model("FinOutboxPersonal",schema);