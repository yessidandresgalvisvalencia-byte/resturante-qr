"use strict";
const mongoose=require("mongoose");
const schema=new mongoose.Schema({
 userId:{type:mongoose.Schema.Types.ObjectId,required:true,index:true},
 tipo:{type:String,enum:["INGRESO","GASTO"],required:true,index:true},
 monto:{type:Number,required:true,min:0},
 categoria:{type:String,required:true,trim:true,maxlength:80},
 descripcion:{type:String,trim:true,maxlength:240,default:""},
 fecha:{type:Date,required:true,index:true},
 origen:{type:String,enum:["MANUAL","IMPORTADO","WEBHOOK"],default:"MANUAL"},
 externalId:{type:String,default:null}
},{timestamps:true,collection:"fin_movimientos"});
schema.index({userId:1,externalId:1},{unique:true,partialFilterExpression:{externalId:{$type:"string"}}});
module.exports=mongoose.models.FinMovimiento||mongoose.model("FinMovimiento",schema);