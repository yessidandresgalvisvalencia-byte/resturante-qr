"use strict";
const mongoose=require("mongoose");
// Control mutable de concurrencia; NO sustituye al ledger de movimientos.
// Se escribe en la misma transacción ACID que el asiento y el saldo de cuenta.
const schema=new mongoose.Schema({
 usuarioId:{type:mongoose.Schema.Types.ObjectId,required:true},
 origenId:{type:mongoose.Schema.Types.ObjectId,required:true},
 periodoInicio:{type:Date,required:true},
 periodoFin:{type:Date,required:true},
 importeCuotaMinor:{type:Number,required:true,min:1,validate:{validator:Number.isSafeInteger}},
 reservadoMinor:{type:Number,required:true,min:0,validate:{validator:Number.isSafeInteger}}
},{timestamps:true,collection:"fin_reservas_cuotas_recurrentes"});
schema.index({usuarioId:1,origenId:1,periodoInicio:1},{unique:true});
module.exports=mongoose.models.ReservaCuotaRecurrentePersonal||
 mongoose.model("ReservaCuotaRecurrentePersonal",schema);
