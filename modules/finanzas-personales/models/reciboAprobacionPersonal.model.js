"use strict";
const mongoose=require("mongoose");
const schema=new mongoose.Schema({
 usuarioId:{type:mongoose.Schema.Types.ObjectId,required:true,immutable:true},borradorId:{type:mongoose.Schema.Types.ObjectId,required:true,immutable:true},itemId:{type:mongoose.Schema.Types.ObjectId,default:null,immutable:true},
 solicitudId:{type:String,required:true,immutable:true,maxlength:100},solicitudHash:{type:String,required:true,immutable:true,match:/^[a-f0-9]{64}$/},
 itemIds:{type:[mongoose.Schema.Types.ObjectId],default:undefined,required:true,immutable:true,validate:v=>v.length>0&&v.length<=100&&new Set(v.map(String)).size===v.length},
 original:{type:mongoose.Schema.Types.Mixed,required:true,immutable:true},resultado:{type:mongoose.Schema.Types.Mixed,required:true,immutable:true},fuentes:{type:[mongoose.Schema.Types.Mixed],default:undefined,required:true,immutable:true},
 fecha:{type:Date,required:true,immutable:true},hashActual:{type:String,required:true,immutable:true,match:/^[a-f0-9]{64}$/}
},{collection:"fin_recibos_aprobacion_personales_v1",versionKey:false,strict:"throw"});
schema.index({usuarioId:1,solicitudId:1},{unique:true,name:"fp_recibo_aprobacion_solicitud_v1"});
schema.index({usuarioId:1,borradorId:1,itemIds:1},{unique:true,name:"fp_recibo_aprobacion_item_v1"});
function prohibir(){throw Object.assign(new Error("RECIBO_APROBACION_APPEND_ONLY"),{statusCode:409});}
for(const op of ["updateOne","updateMany","replaceOne","findOneAndUpdate","findOneAndReplace","deleteOne","deleteMany","findOneAndDelete","bulkWrite"])schema.pre(op,prohibir);
schema.pre("deleteOne",{document:true,query:false},prohibir);schema.pre("save",function(){if(!this.isNew)prohibir();});
module.exports=mongoose.models.ReciboAprobacionPersonal||mongoose.model("ReciboAprobacionPersonal",schema);
