"use strict";
const mongoose=require("mongoose");
const schema=new mongoose.Schema({
 usuarioId:{type:mongoose.Schema.Types.ObjectId,required:true,unique:true,index:true},
 headHash:{type:String,default:null,match:/^[a-f0-9]{64}$/},
 secuencia:{type:Number,default:0,min:0,validate:{validator:Number.isSafeInteger,message:"secuencia inválida"}}
},{timestamps:true,versionKey:"version"});
module.exports=mongoose.models.DecisionChainHeadPersonal||mongoose.model("DecisionChainHeadPersonal",schema);
