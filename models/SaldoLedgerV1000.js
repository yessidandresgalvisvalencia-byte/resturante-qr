"use strict";
const mongoose=require("mongoose");
const saldoSeguro=v=>Number.isSafeInteger(v)&&v>=0;
const hashValido=v=>typeof v==="string"&&/^[a-f0-9]{64}$/.test(v);
const schema=new mongoose.Schema({
 empresaId:{type:String,required:true,immutable:true},
 sedeId:{type:String,required:true,immutable:true},
 saldoCentavos:{type:Number,required:true,default:0,validate:{validator:saldoSeguro,message:"LEDGER_SALDO_INVALIDO"}},
 hashUltimo:{type:String,required:true,default:"0".repeat(64),validate:{validator:hashValido,message:"LEDGER_HASH_INVALIDO"}},
 secuencia:{type:Number,required:true,default:0,validate:{validator:saldoSeguro,message:"LEDGER_SECUENCIA_INVALIDA"}}
},{collection:"gruk_saldos_ledger_v1000",strict:"throw",versionKey:false});
schema.index({empresaId:1,sedeId:1},{unique:true});
module.exports=mongoose.models.SaldoLedgerV1000||mongoose.model("SaldoLedgerV1000",schema);
