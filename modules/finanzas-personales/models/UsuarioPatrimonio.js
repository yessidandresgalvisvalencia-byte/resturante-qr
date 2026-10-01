"use strict";
const mongoose=require("mongoose");
const schema=new mongoose.Schema({usuarioId:{type:mongoose.Schema.Types.ObjectId,required:true,unique:true,index:true},monedaBase:{type:String,enum:["COP"],default:"COP"},fondoEmergenciaObjetivoMeses:{type:Number,default:6,min:1,max:24},ahorroObjetivoPct:{type:Number,default:10,min:0,max:100},saldoLiquidoMinor:{type:Number,default:0,min:0,validate:{validator:Number.isSafeInteger,message:"Saldo inválido"}},versionPolitica:{type:Number,default:2,min:1}},{timestamps:true,collection:"fin_usuarios_patrimonio"});
schema.set("toJSON",{transform:(_d,r)=>{delete r.__v;return r;}});
module.exports=mongoose.models.UsuarioPatrimonio||mongoose.model("UsuarioPatrimonio",schema);