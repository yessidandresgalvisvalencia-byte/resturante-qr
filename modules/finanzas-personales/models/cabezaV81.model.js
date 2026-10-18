"use strict";
const mongoose = require("mongoose");
const schema = new mongoose.Schema({
 usuarioId: {type: mongoose.Schema.Types.ObjectId,required:true,unique:true,immutable:true},
 version: {type:Number,required:true,default:0,min:0,validate:Number.isSafeInteger},
 hashActual: {type:String,required:true,default:"0".repeat(64),match:/^[a-f0-9]{64}$/}
},{collection:"fin_cabezas_v81",timestamps:true});
module.exports=mongoose.models.FinCabezaV81||mongoose.model("FinCabezaV81",schema);
