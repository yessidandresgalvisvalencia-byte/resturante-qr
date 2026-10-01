"use strict";
const mongoose=require("mongoose");
const schema=new mongoose.Schema({
 usuarioId:{type:mongoose.Schema.Types.ObjectId,required:true,unique:true,index:true},
 monedaBase:{type:String,default:"COP",uppercase:true,trim:true},
 fondoEmergenciaObjetivoMeses:{type:Number,default:6,min:1,max:24},
 ahorroObjetivoPct:{type:Number,default:10,min:0,max:100},
 saldoLiquido:{type:Number,default:0,min:0},
 versionPolitica:{type:Number,default:1,min:1}
},{timestamps:true,collection:"fin_usuarios_patrimonio"});
schema.set("toJSON",{transform:(_d,r)=>{delete r.__v;return r;}});
module.exports=mongoose.models.UsuarioPatrimonio||mongoose.model("UsuarioPatrimonio",schema);