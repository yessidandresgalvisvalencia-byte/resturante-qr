"use strict";
const mongoose=require("mongoose");
const s=new mongoose.Schema({usuarioId:{type:mongoose.Schema.Types.ObjectId,required:true},calendarioId:{type:mongoose.Schema.Types.ObjectId,required:true},ordenUsuario:{type:Number,required:true,min:1,validate:Number.isSafeInteger},secuencia:{type:Number,required:true,min:1,validate:Number.isSafeInteger},solicitudId:{type:String,required:true},solicitudHuella:{type:String,required:true,match:/^[a-f0-9]{64}$/},solicitud:{type:mongoose.Schema.Types.Mixed,required:true},anterior:{type:mongoose.Schema.Types.Mixed,default:null},posterior:{type:mongoose.Schema.Types.Mixed,required:true},auditoria:{type:mongoose.Schema.Types.Mixed,required:true},fecha:{type:Date,required:true},hashAnterior:{type:String,required:true,match:/^[a-f0-9]{64}$/},hashActual:{type:String,required:true,match:/^[a-f0-9]{64}$/}},{collection:"fin_eventos_calendario_ingreso_personales_v1",strict:"throw",versionKey:false});
s.index({usuarioId:1,calendarioId:1,secuencia:1},{unique:true,name:"fp_cal_ingreso_secuencia_v1"});
s.index({usuarioId:1,ordenUsuario:1},{unique:true,name:"fp_cal_ingreso_orden_usuario_v1"});
s.index({usuarioId:1,solicitudId:1},{unique:true,name:"fp_cal_ingreso_solicitud_v1"});
function prohibir(){throw Object.assign(Error("CALENDARIO_INGRESO_APPEND_ONLY"),{statusCode:409});}
for(const op of ["updateOne","updateMany","replaceOne","findOneAndUpdate","findOneAndReplace","deleteOne","deleteMany","findOneAndDelete","bulkWrite"])s.pre(op,prohibir);
s.pre("deleteOne",{document:true,query:false},prohibir);s.pre("save",function(){if(!this.isNew)prohibir();});
module.exports=mongoose.models.EventoCalendarioIngresoPersonal||mongoose.model("EventoCalendarioIngresoPersonal",s);
