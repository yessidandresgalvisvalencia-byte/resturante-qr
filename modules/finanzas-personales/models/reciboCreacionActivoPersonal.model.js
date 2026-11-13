"use strict";
const mongoose=require("mongoose");
const inmutable={required:true,immutable:true};
const s=new mongoose.Schema({usuarioId:{type:mongoose.Schema.Types.ObjectId,...inmutable},solicitudId:{type:String,maxlength:100,...inmutable},solicitudHuella:{type:String,match:/^[a-f0-9]{64}$/,...inmutable},activoId:{type:mongoose.Schema.Types.ObjectId,...inmutable},legacyId:{type:mongoose.Schema.Types.ObjectId,...inmutable},nombreClave:{type:String,maxlength:120,...inmutable},solicitud:{type:mongoose.Schema.Types.Mixed,...inmutable},original:{type:mongoose.Schema.Types.Mixed,...inmutable},legacyOriginal:{type:mongoose.Schema.Types.Mixed,...inmutable},fecha:{type:Date,...inmutable},hashActual:{type:String,match:/^[a-f0-9]{64}$/,...inmutable}},{collection:"fin_recibos_creacion_activos_personales_v1",strict:"throw",versionKey:false});
s.index({usuarioId:1,solicitudId:1},{unique:true,name:"fp_activo_recibo_solicitud_v1"});
s.index({usuarioId:1,activoId:1},{unique:true,name:"fp_activo_recibo_fuente_v1"});
s.index({usuarioId:1,nombreClave:1},{unique:true,name:"fp_activo_recibo_nombre_v1"});
function prohibir(){throw Object.assign(new Error("RECIBO_CREACION_ACTIVO_APPEND_ONLY"),{statusCode:409});}
for(const op of ["updateOne","updateMany","replaceOne","findOneAndUpdate","findOneAndReplace","deleteOne","deleteMany","findOneAndDelete","bulkWrite"])s.pre(op,prohibir);
s.pre("deleteOne",{document:true,query:false},prohibir);s.pre("save",function(){if(!this.isNew)prohibir();});
module.exports=mongoose.models.ReciboCreacionActivoPersonal||mongoose.model("ReciboCreacionActivoPersonal",s);
