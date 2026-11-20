"use strict";
const mongoose=require("mongoose"),entero={type:Number,required:true,min:0,validate:Number.isSafeInteger},h={type:String,required:true,match:/^[a-f0-9]{64}$/};
const s=new mongoose.Schema({usuarioId:{type:mongoose.Schema.Types.ObjectId,required:true,immutable:true},revision:entero,creaciones:entero,creacionesHash:h,eventos:entero,eventosHash:h},{collection:"fin_cursor_metas_personales_v1",strict:"throw",versionKey:false});
s.index({usuarioId:1},{unique:true,name:"fp_cursor_meta_propietario_v1"});
module.exports=mongoose.models.CursorMetaPersonal||mongoose.model("CursorMetaPersonal",s);
