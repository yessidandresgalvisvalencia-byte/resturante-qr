"use strict";
const mongoose=require("mongoose");
const schema=new mongoose.Schema({usuarioId:{type:mongoose.Schema.Types.ObjectId,required:true,index:true},tipo:{type:String,enum:["INGRESO","GASTO_FIJO","OBLIGACION"],required:true},concepto:{type:String,required:true,maxlength:140},montoMinor:{type:Number,min:0,default:0},frecuencia:{type:String,enum:["MENSUAL"],default:"MENSUAL"},diaMes:{type:Number,min:1,max:31,required:true},activo:{type:Boolean,default:true},origen:{type:String,enum:["CONVERSACION","SISTEMA","USUARIO"],default:"CONVERSACION"},sourceId:{type:mongoose.Schema.Types.ObjectId,default:null}},{timestamps:true,collection:"fin_calendario_financiero"});
schema.index({usuarioId:1,tipo:1,concepto:1,activo:1});
// Los calendarios anteriores son fuentes originales. Sus cambios deben usar
// eventos explícitos; nunca reescribir la fuente para facilitar una adopción.
function prohibir(){throw Object.assign(Error("CALENDARIO_LEGADO_APPEND_ONLY"),{statusCode:409});}
for(const op of ["updateOne","updateMany","replaceOne","findOneAndUpdate","findOneAndReplace","deleteOne","deleteMany","findOneAndDelete","bulkWrite"])schema.pre(op,prohibir);
schema.pre("deleteOne",{document:true,query:false},prohibir);
schema.pre("save",function(){if(!this.isNew)prohibir();});
module.exports=mongoose.models.CalendarioFinanciero||mongoose.model("CalendarioFinanciero",schema);
