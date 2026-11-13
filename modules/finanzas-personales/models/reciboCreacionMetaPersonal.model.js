"use strict";
const mongoose=require("mongoose");
const inmutable={required:true,immutable:true};
const s=new mongoose.Schema({usuarioId:{type:mongoose.Schema.Types.ObjectId,...inmutable},solicitudId:{type:String,maxlength:100,...inmutable},solicitudHuella:{type:String,match:/^[a-f0-9]{64}$/,...inmutable},metaId:{type:mongoose.Schema.Types.ObjectId,...inmutable},nombreClave:{type:String,maxlength:120,...inmutable},secuencia:{type:Number,min:1,validate:Number.isSafeInteger,...inmutable},hashAnterior:{type:String,match:/^[a-f0-9]{64}$/,...inmutable},solicitud:{type:mongoose.Schema.Types.Mixed,...inmutable},original:{type:mongoose.Schema.Types.Mixed,...inmutable},fecha:{type:Date,...inmutable},hashActual:{type:String,match:/^[a-f0-9]{64}$/,...inmutable}},{collection:"fin_recibos_creacion_metas_personales_v1",strict:"throw",versionKey:false});
s.index({usuarioId:1,solicitudId:1},{unique:true,name:"fp_meta_recibo_solicitud_v1"});
s.index({usuarioId:1,metaId:1},{unique:true,name:"fp_meta_recibo_fuente_v1"});
s.index({usuarioId:1,nombreClave:1},{unique:true,name:"fp_meta_recibo_nombre_v1"});
s.index({usuarioId:1,secuencia:1},{unique:true,name:"fp_meta_recibo_secuencia_v1"});
function prohibir(){throw Object.assign(new Error("RECIBO_CREACION_META_APPEND_ONLY"),{statusCode:409});}
for(const op of ["updateOne","updateMany","replaceOne","findOneAndUpdate","findOneAndReplace","deleteOne","deleteMany","findOneAndDelete","bulkWrite"])s.pre(op,prohibir);
s.pre("deleteOne",{document:true,query:false},prohibir);s.pre("save",function(){if(!this.isNew)prohibir();});
module.exports=mongoose.models.ReciboCreacionMetaPersonal||mongoose.model("ReciboCreacionMetaPersonal",s);
