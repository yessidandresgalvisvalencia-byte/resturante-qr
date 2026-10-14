"use strict";
const mongoose=require("mongoose");
const schema=new mongoose.Schema({
 empresaId:{type:String,required:true,immutable:true},
 sedeId:{type:String,required:true,immutable:true},
 saldoCentavos:{type:Number,required:true,default:0},
 hashUltimo:{type:String,required:true,default:"0".repeat(64)},
 secuencia:{type:Number,required:true,default:0}
},{collection:"gruk_saldos_ledger_v1000",strict:"throw",versionKey:false});
schema.index({empresaId:1,sedeId:1},{unique:true});
module.exports=mongoose.models.SaldoLedgerV1000||mongoose.model("SaldoLedgerV1000",schema);
