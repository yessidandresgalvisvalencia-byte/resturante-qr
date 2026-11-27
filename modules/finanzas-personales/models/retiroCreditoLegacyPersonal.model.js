"use strict";
const mongoose=require("mongoose");
const schema=new mongoose.Schema({
 usuarioId:{type:mongoose.Schema.Types.ObjectId,required:true,immutable:true},
 creditoId:{type:mongoose.Schema.Types.ObjectId,required:true,immutable:true},
 secuencia:{type:Number,required:true,immutable:true,validate:Number.isSafeInteger,min:1},
 solicitudId:{type:String,required:true,immutable:true,maxlength:100},
 tipo:{type:String,enum:["RETIRO","RESTAURACION","INCORPORACION"],required:true,immutable:true},
 prestamoIncorporadoId:{type:mongoose.Schema.Types.ObjectId,default:null,immutable:true},
 referencia:{type:String,default:null,immutable:true},
 anterior:{type:mongoose.Schema.Types.Mixed,required:true,immutable:true},
 posterior:{type:mongoose.Schema.Types.Mixed,required:true,immutable:true},
 fecha:{type:Date,required:true,immutable:true},
 hashAnterior:{type:String,required:true,immutable:true,match:/^[a-f0-9]{64}$/},
 hashActual:{type:String,required:true,immutable:true,match:/^[a-f0-9]{64}$/}
},{collection:"fin_ciclo_creditos_legacy_personales_v1",versionKey:false,strict:"throw"});
schema.index({usuarioId:1,creditoId:1,secuencia:1},{unique:true,name:"fp_legacy_ciclo_secuencia_v1"});
schema.index({usuarioId:1,solicitudId:1},{unique:true,name:"fp_legacy_ciclo_solicitud_v1"});
function prohibir(){throw Object.assign(new Error("CREDITO_LEGACY_APPEND_ONLY"),{statusCode:409});}
for(const op of ["updateOne","updateMany","findOneAndUpdate","replaceOne","findOneAndReplace","deleteOne","deleteMany","findOneAndDelete","bulkWrite"])schema.pre(op,prohibir);
schema.pre("deleteOne",{document:true,query:false},prohibir);
schema.pre("save",function(){if(!this.isNew)prohibir();});
module.exports=mongoose.models.RetiroCreditoLegacyPersonal||mongoose.model("RetiroCreditoLegacyPersonal",schema);
