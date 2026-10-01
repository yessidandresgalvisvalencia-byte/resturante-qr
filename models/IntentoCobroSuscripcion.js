"use strict";
const mongoose=require("mongoose");
const intentoSchema=new mongoose.Schema({
 empresaId:{type:mongoose.Schema.Types.ObjectId,ref:"Empresa",default:null,index:true},
 restaurantId:{type:String,default:null,index:true},
 periodo:{type:String,required:true},
 reference:{type:String,required:true,unique:true},
 amountInCents:{type:Number,required:true,min:1},
 currency:{type:String,required:true,default:"COP"},
 transactionId:{type:String,default:"",index:true},
 estado:{type:String,enum:["CREADO","ENVIANDO","ENVIADO","PENDIENTE","APROBADO","RECHAZADO","ERROR_ENVIO","RESULTADO_DESCONOCIDO"],default:"CREADO",index:true},
 ultimoError:{type:String,default:""},
 enviadoAt:{type:Date,default:null},
 inicioEnvioAt:{type:Date,default:null},
 resueltoAt:{type:Date,default:null}
},{timestamps:true});
intentoSchema.index({restaurantId:1,periodo:1},{unique:true,partialFilterExpression:{restaurantId:{$type:"string"}}});
intentoSchema.index({empresaId:1,periodo:1},{unique:true,partialFilterExpression:{empresaId:{$type:"objectId"}}});
module.exports=mongoose.model("IntentoCobroSuscripcion",intentoSchema);