"use strict";
const mongoose=require("mongoose");
const schema=new mongoose.Schema({
 usuarioId:{type:mongoose.Schema.Types.ObjectId,required:true,index:true},
 obligacionId:{type:mongoose.Schema.Types.ObjectId,required:true},
 idempotencyHash:{type:String,required:true,match:/^[a-f0-9]{64}$/},
 tipo:{type:String,required:true,enum:["CANCELACION_OBLIGACION_PREVISTA"]},
 fecha:{type:Date,required:true},
 motivo:{type:String,required:true,trim:true,minlength:1,maxlength:240},
 snapshot:{
  montoMinor:{type:Number,required:true,min:1,validate:Number.isSafeInteger},
  concepto:{type:String,required:true},
  categoria:{type:String,required:true},
  fecha:{type:Date,required:true},
  frecuencia:{type:String,required:true},
  recurrente:{type:Boolean,required:true}
 }
},{collection:"fin_cancelaciones_obligaciones_previstas_v1",timestamps:false,versionKey:false,strict:"throw"});
schema.index({usuarioId:1,obligacionId:1},{unique:true,name:"fp_cancelacion_unica_obligacion"});
schema.index({usuarioId:1,idempotencyHash:1},{unique:true,name:"fp_cancelacion_idempotencia"});
function bloquear(){throw new Error("CANCELACION_APPEND_ONLY: UPDATE/DELETE prohibido");}
schema.pre("save",function(){if(!this.isNew)bloquear();});
for(const op of ["updateOne","updateMany","findOneAndUpdate","replaceOne",
 "findOneAndReplace","deleteOne","deleteMany","findOneAndDelete"]){
 schema.pre(op,{query:true,document:false},bloquear);
}
schema.pre("deleteOne",{document:true,query:false},bloquear);
module.exports=mongoose.models.CancelacionObligacionPrevistaPersonal||
 mongoose.model("CancelacionObligacionPrevistaPersonal",schema);
