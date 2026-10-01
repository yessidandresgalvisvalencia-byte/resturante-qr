"use strict";
const mongoose=require("mongoose");
const schema=new mongoose.Schema({
 empresaId:{type:mongoose.Schema.Types.ObjectId,ref:"Empresa",required:true,unique:true,index:true},
 plan:{type:String,enum:["MENSUAL"],default:"MENSUAL",required:true},
 precioMensualMinor:{type:Number,required:true,min:1,default:22000000},
 moneda:{type:String,enum:["COP"],default:"COP",required:true},
 estado:{type:String,enum:["PENDIENTE","ACTIVA","INACTIVA","SUSPENDIDA"],default:"PENDIENTE",index:true},
 fechaUltimoPago:{type:Date,default:null},
 fechaProximoCobro:{type:Date,default:null,index:true},
 ultimoTransactionId:{type:String,default:""},
 paymentSourceId:{type:String,default:""},
 customerEmail:{type:String,default:""},
 tokenizacionCompleta:{type:Boolean,default:false}
},{timestamps:true});
schema.index({ultimoTransactionId:1},{unique:true,partialFilterExpression:{ultimoTransactionId:{$type:"string",$gt:""}}});
module.exports=mongoose.model("SuscripcionEmpresa",schema);