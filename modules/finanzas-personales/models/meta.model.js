"use strict";
const mongoose=require("mongoose");
const schema=new mongoose.Schema({userId:{type:mongoose.Schema.Types.ObjectId,required:true,index:true},nombre:{type:String,required:true,trim:true,maxlength:120},objetivo:{type:Number,required:true,min:0},acumulado:{type:Number,default:0,min:0},fechaObjetivo:{type:Date,default:null},creacionSolicitudId:{type:String,default:undefined,immutable:true},creacionReciboHash:{type:String,match:/^[a-f0-9]{64}$/,default:undefined,immutable:true},origenAcumulado:{type:String,enum:["DECLARACION_USUARIO"],default:undefined,immutable:true},estado:{type:String,enum:["ACTIVA","CUMPLIDA","PAUSADA"],default:"ACTIVA",index:true}},{timestamps:true,collection:"fin_metas"});
schema.index({userId:1,estado:1});
schema.index({userId:1,_id:-1},{name:"fp_metas_lectura_v1"});
schema.index({userId:1,creacionSolicitudId:1},{unique:true,partialFilterExpression:{creacionSolicitudId:{$type:"string"}},name:"fp_meta_solicitud_v1"});
function prohibir(){throw Object.assign(Error("META_ORIGINAL_APPEND_ONLY"),{statusCode:409});}
for(const op of ["updateOne","updateMany","replaceOne","findOneAndUpdate","findOneAndReplace","deleteOne","deleteMany","findOneAndDelete","bulkWrite"])schema.pre(op,prohibir);
schema.pre("deleteOne",{document:true,query:false},prohibir);schema.pre("save",function(){if(!this.isNew)prohibir();});
module.exports=mongoose.models.FinMeta||mongoose.model("FinMeta",schema);