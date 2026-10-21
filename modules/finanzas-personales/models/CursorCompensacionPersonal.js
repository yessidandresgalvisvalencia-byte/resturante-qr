"use strict";
const mongoose=require("mongoose");
const HEX=/^[a-f0-9]{64}$/;
const schema=new mongoose.Schema({
 _id:{type:String,required:true,match:/^[A-Za-z0-9_-]{1,128}$/},
 secuencia:{type:Number,required:true,min:0,validate:Number.isSafeInteger},
 hashActual:{type:String,required:true,match:HEX},
 // Fence compartido: mutaciones heredadas y compensaciones disputan el mismo documento.
 revisionLegada:{type:Number,default:0,min:0,validate:Number.isSafeInteger}
},{collection:"fin_cursor_compensaciones_personales_v1",strict:"throw",versionKey:false,timestamps:false});
// Metadatos MUTABLES de control, separados de los eventos financieros INSERT-only.
// _id tiene índice único intrínseco: una fila de cursor por usuario.
module.exports=mongoose.models.CursorCompensacionPersonal||
 mongoose.model("CursorCompensacionPersonal",schema);
