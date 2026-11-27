"use strict";
const mongoose=require("mongoose"),s=new mongoose.Schema({
 usuarioId:{type:mongoose.Schema.Types.ObjectId,required:true,immutable:true},prestamoId:{type:mongoose.Schema.Types.ObjectId,required:true,immutable:true},
 solicitudId:{type:String,required:true,immutable:true,match:/^[A-Za-z0-9_-]{8,100}$/},
 secuencia:{type:Number,required:true,immutable:true,min:1,validate:Number.isSafeInteger},
 solicitud:{type:mongoose.Schema.Types.Mixed,required:true,immutable:true},resultado:{type:String,enum:["APLICADA","CERRADA"],required:true,immutable:true},
 eventoHash:{type:String,default:null,immutable:true},fecha:{type:Date,required:true,immutable:true},
 auditoriaContexto:{type:mongoose.Schema.Types.Mixed,default:undefined,immutable:true,select:false},
 hashAnterior:{type:String,required:true,immutable:true,match:/^[a-f0-9]{64}$/},hashActual:{type:String,required:true,immutable:true,match:/^[a-f0-9]{64}$/}
},{collection:"fin_resoluciones_retiros_deudas_personales_v1",strict:"throw",versionKey:false});
s.index({usuarioId:1,solicitudId:1},{unique:true,name:"fp_resolucion_retiro_clave_v1"});
s.index({usuarioId:1,prestamoId:1,secuencia:1},{unique:true,name:"fp_resolucion_retiro_secuencia_v1"});
for(const f of ["toJSON","toObject"])s.set(f,{transform:(_d,r)=>{delete r.auditoriaContexto;return r;}});
function prohibir(){throw Object.assign(new Error("RESOLUCION_RETIRO_APPEND_ONLY"),{statusCode:409});}
for(const op of ["updateOne","updateMany","findOneAndUpdate","replaceOne","findOneAndReplace","deleteOne","deleteMany","findOneAndDelete","bulkWrite"])s.pre(op,prohibir);
s.pre("deleteOne",{document:true,query:false},prohibir);s.pre("save",function(){if(!this.isNew)prohibir();});
module.exports=mongoose.models.ResolucionRetiroDeudaPersonal||mongoose.model("ResolucionRetiroDeudaPersonal",s);
