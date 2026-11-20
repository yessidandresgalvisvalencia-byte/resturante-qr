"use strict";
const mongoose=require("mongoose");
const s=new mongoose.Schema({
 ruta:{type:String,enum:["/prestamos","/creditos"],default:undefined,immutable:true},
 usuarioId:{type:mongoose.Schema.Types.ObjectId,required:true,immutable:true},solicitudId:{type:String,required:true,immutable:true,maxlength:100},
 solicitudHuella:{type:String,required:true,immutable:true,match:/^[a-f0-9]{64}$/},solicitud:{type:mongoose.Schema.Types.Mixed,required:true,immutable:true},
 prestamoId:{type:mongoose.Schema.Types.ObjectId,required:true,immutable:true},fuentes:{type:[mongoose.Schema.Types.Mixed],default:undefined,required:true,immutable:true},
 fecha:{type:Date,required:true,immutable:true},hashActual:{type:String,required:true,immutable:true,match:/^[a-f0-9]{64}$/}
},{collection:"fin_recibos_creacion_prestamos_personales_v1",versionKey:false,strict:"throw"});
s.index({usuarioId:1,solicitudId:1},{unique:true,name:"fp_recibo_creacion_prestamo_solicitud_v1"});
s.index({usuarioId:1,prestamoId:1},{unique:true,name:"fp_recibo_creacion_prestamo_fuente_v1"});
function prohibir(){throw Object.assign(new Error("RECIBO_CREACION_PRESTAMO_APPEND_ONLY"),{statusCode:409});}
for(const op of ["updateOne","updateMany","replaceOne","findOneAndUpdate","findOneAndReplace","deleteOne","deleteMany","findOneAndDelete","bulkWrite"])s.pre(op,prohibir);
s.pre("deleteOne",{document:true,query:false},prohibir);s.pre("save",function(){if(!this.isNew)prohibir();});
module.exports=mongoose.models.ReciboCreacionPrestamoPersonal||mongoose.model("ReciboCreacionPrestamoPersonal",s);
