"use strict";
const mongoose=require("mongoose"),i={required:true,immutable:true};
const s=new mongoose.Schema({auditoriaContexto:{type:mongoose.Schema.Types.Mixed,default:undefined,immutable:true},usuarioId:{type:mongoose.Schema.Types.ObjectId,...i},metaId:{type:mongoose.Schema.Types.ObjectId,...i},secuencia:{type:Number,min:1,validate:Number.isSafeInteger,...i},revisionMeta:{type:Number,min:1,validate:Number.isSafeInteger,...i},solicitudId:{type:String,maxlength:100,...i},solicitudHuella:{type:String,match:/^[a-f0-9]{64}$/,...i},tipo:{type:String,enum:["CORRECCION","RETIRO","RESTAURACION","ADOPCION"],...i},referencia:{type:String,default:null,immutable:true},solicitud:{type:mongoose.Schema.Types.Mixed,...i},original:{type:mongoose.Schema.Types.Mixed,...i},antes:{type:mongoose.Schema.Types.Mixed,...i},fecha:{type:Date,...i},hashAnterior:{type:String,match:/^[a-f0-9]{64}$/,...i},hashActual:{type:String,match:/^[a-f0-9]{64}$/,...i}},{collection:"fin_ciclo_metas_personales_v1",strict:"throw",versionKey:false});
s.index({usuarioId:1,secuencia:1},{unique:true,name:"fp_ciclo_meta_secuencia_v1"});
s.index({usuarioId:1,solicitudId:1},{unique:true,name:"fp_ciclo_meta_solicitud_v1"});
s.index({usuarioId:1,metaId:1,revisionMeta:1},{unique:true,name:"fp_ciclo_meta_revision_v1"});
function bloquear(){throw Object.assign(Error("CICLO_META_APPEND_ONLY"),{statusCode:409});}
for(const op of ["updateOne","updateMany","replaceOne","findOneAndUpdate","findOneAndReplace","deleteOne","deleteMany","findOneAndDelete","bulkWrite"])s.pre(op,bloquear);
s.pre("deleteOne",{document:true,query:false},bloquear);s.pre("save",function(){if(!this.isNew)bloquear();});
module.exports=mongoose.models.CicloMetaPersonal||mongoose.model("CicloMetaPersonal",s);
