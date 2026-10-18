"use strict";
const mongoose=require("mongoose");
const schema=new mongoose.Schema({
 userId:{type:mongoose.Schema.Types.ObjectId,required:true,index:true},
 tipo:{type:String,enum:["INGRESO","GASTO"],required:true,index:true},
 monto:{type:Number,required:true,min:0},
 concepto:{type:String,required:true,trim:true,maxlength:140},
 categoria:{type:String,required:true,trim:true,maxlength:80,index:true},
 subcategoria:{type:String,trim:true,maxlength:80,default:""},
 cuenta:{type:String,trim:true,maxlength:100,default:"EFECTIVO"},
 medioPago:{type:String,enum:["EFECTIVO","DEBITO","CREDITO","TRANSFERENCIA","PSE","OTRO"],default:"EFECTIVO"},
 contraparte:{type:String,trim:true,maxlength:140,default:""},
 descripcion:{type:String,trim:true,maxlength:240,default:""},
 fecha:{type:Date,required:true,index:true},
 recurrente:{type:Boolean,default:false},
 frecuencia:{type:String,enum:["NINGUNA","DIARIA","SEMANAL","QUINCENAL","MENSUAL","ANUAL"],default:"NINGUNA"},
 origen:{type:String,enum:["MANUAL","IMPORTADO","WEBHOOK"],default:"MANUAL"},
 externalId:{type:String,default:null}
},{timestamps:true,collection:"fin_movimientos"});
schema.index({userId:1,fecha:-1});schema.index({userId:1,tipo:1,categoria:1,fecha:-1});
schema.index({userId:1,externalId:1},{unique:true,partialFilterExpression:{externalId:{$type:"string"}}});
module.exports=mongoose.models.FinMovimiento||mongoose.model("FinMovimiento",schema);