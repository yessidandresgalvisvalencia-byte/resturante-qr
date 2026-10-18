"use strict";
const mongoose=require("mongoose");
const schema=new mongoose.Schema({
 usuarioId:{type:mongoose.Schema.Types.ObjectId,required:true,index:true},
 clave:{type:String,required:true,maxlength:220},
 palanca:{type:String,enum:["INGRESOS","GASTO","DEUDA","COBRO"],required:true,index:true},
 titulo:{type:String,required:true,maxlength:180},
 objetivoMinor:{type:Number,required:true,min:0,validate:{validator:Number.isSafeInteger,message:"objetivoMinor inválido"}},
 baselineMinor:{type:Number,default:0,validate:{validator:Number.isSafeInteger,message:"baselineMinor inválido"}},
 resultadoMinor:{type:Number,default:0,validate:{validator:Number.isSafeInteger,message:"resultadoMinor inválido"}},
 estado:{type:String,enum:["PROPUESTA","APROBADA","COMPLETADA","DESCARTADA"],default:"PROPUESTA",index:true},
 evidencia:{type:String,default:"",maxlength:300},
 transaccionEvidenciaId:{type:mongoose.Schema.Types.ObjectId,ref:"TransaccionPersonal",default:null,index:true},
 completadaEn:{type:Date,default:null}
},{timestamps:true,collection:"fin_acciones_progreso_personal"});
schema.index({usuarioId:1,clave:1},{unique:true});
module.exports=mongoose.models.AccionProgresoPersonal||mongoose.model("AccionProgresoPersonal",schema);
