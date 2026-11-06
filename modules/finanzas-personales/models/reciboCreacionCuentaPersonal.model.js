"use strict";
const mongoose=require("mongoose");
const s=new mongoose.Schema({
 usuarioId:{type:mongoose.Schema.Types.ObjectId,required:true,immutable:true},solicitudId:{type:String,required:true,maxlength:100,immutable:true},solicitudHuella:{type:String,required:true,match:/^[a-f0-9]{64}$/,immutable:true},
 cuentaId:{type:mongoose.Schema.Types.ObjectId,required:true,immutable:true},nombreClave:{type:String,required:true,maxlength:100,immutable:true},solicitud:{type:mongoose.Schema.Types.Mixed,required:true,immutable:true},original:{type:mongoose.Schema.Types.Mixed,required:true,immutable:true},evento:{type:mongoose.Schema.Types.Mixed,default:null,immutable:true},fecha:{type:Date,required:true,immutable:true},hashActual:{type:String,required:true,match:/^[a-f0-9]{64}$/,immutable:true}
},{collection:"fin_recibos_creacion_cuentas_personales_v1",strict:"throw",versionKey:false});
s.index({usuarioId:1,solicitudId:1},{unique:true,name:"fp_cuenta_recibo_solicitud_v1"});
s.index({usuarioId:1,cuentaId:1},{unique:true,name:"fp_cuenta_recibo_fuente_v1"});
s.index({usuarioId:1,nombreClave:1},{unique:true,name:"fp_cuenta_recibo_nombre_v1"});
function prohibir(){throw Object.assign(new Error("RECIBO_CREACION_CUENTA_APPEND_ONLY"),{statusCode:409});}
for(const op of ["updateOne","updateMany","replaceOne","findOneAndUpdate","findOneAndReplace","deleteOne","deleteMany","findOneAndDelete","bulkWrite"])s.pre(op,prohibir);
s.pre("deleteOne",{document:true,query:false},prohibir);s.pre("save",function(){if(!this.isNew)prohibir();});
module.exports=mongoose.models.ReciboCreacionCuentaPersonal||mongoose.model("ReciboCreacionCuentaPersonal",s);
