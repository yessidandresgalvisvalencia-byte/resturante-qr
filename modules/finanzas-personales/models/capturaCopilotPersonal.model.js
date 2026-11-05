"use strict";
const mongoose=require("mongoose");
const s=new mongoose.Schema({usuarioId:{type:mongoose.Schema.Types.ObjectId,required:true,immutable:true},solicitudId:{type:String,required:true,immutable:true},solicitudHuella:{type:String,required:true,immutable:true,match:/^[a-f0-9]{64}$/},solicitud:{type:mongoose.Schema.Types.Mixed,required:true,immutable:true},resultado:{type:mongoose.Schema.Types.Mixed,required:true,immutable:true},turnoId:{type:mongoose.Schema.Types.ObjectId,required:true,immutable:true},turnoOriginal:{type:mongoose.Schema.Types.Mixed,required:true,immutable:true},fecha:{type:Date,required:true,immutable:true},hashActual:{type:String,required:true,immutable:true,match:/^[a-f0-9]{64}$/}},{collection:"fin_capturas_copilot_personales_v1",strict:"throw",versionKey:false});
s.index({usuarioId:1,solicitudId:1},{unique:true,name:"fp_copilot_solicitud_v1"});
s.index({usuarioId:1,turnoId:1},{unique:true,name:"fp_copilot_turno_v1"});
function prohibir(){throw Object.assign(new Error("CAPTURA_COPILOT_APPEND_ONLY"),{statusCode:409});}
for(const op of ["updateOne","updateMany","replaceOne","findOneAndUpdate","findOneAndReplace","deleteOne","deleteMany","findOneAndDelete","bulkWrite"])s.pre(op,prohibir);
s.pre("deleteOne",{document:true,query:false},prohibir);s.pre("save",function(){if(!this.isNew)prohibir();});
module.exports=mongoose.models.CapturaCopilotPersonal||mongoose.model("CapturaCopilotPersonal",s);
