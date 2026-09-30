"use strict";
const mongoose=require("mongoose");
const schema=new mongoose.Schema({
 empresaId:{type:mongoose.Schema.Types.ObjectId,ref:"Empresa",required:true,index:true},
 sedeId:{type:mongoose.Schema.Types.ObjectId,ref:"Sede",default:null,index:true},
 decisionId:{type:mongoose.Schema.Types.ObjectId,ref:"CerebroDecision",required:true,index:true},
 ordenId:{type:mongoose.Schema.Types.ObjectId,required:true,index:true},
 memoriaId:{type:mongoose.Schema.Types.ObjectId,ref:"CerebroMemoria",required:true,index:true},
 kpi:{type:String,required:true},
 hipotesis:{type:String,required:true,maxlength:1000},
 baseline:{valor:{type:Number,default:null},measuredAt:{type:Date,required:true}},
 resultadoObservado:{valor:{type:Number,default:null},measuredAt:{type:Date,required:true},variacionAbsoluta:{type:Number,default:null},variacionPorcentual:{type:Number,default:null},clasificacion:{type:String,enum:["MEJORO","SIN_CAMBIO","EMPEORO","NO_MEDIBLE"],required:true}},
 atribucion:{estado:{type:String,enum:["NO_DEMOSTRADA","EVIDENCIA_PARCIAL","DEMOSTRADA"],default:"NO_DEMOSTRADA"},metodo:{type:String,enum:["ANTES_DESPUES","GRUPO_CONTROL","AB_TEST","CUASI_EXPERIMENTO"],default:"ANTES_DESPUES"},advertencia:{type:String,required:true}},
 createdBy:{type:mongoose.Schema.Types.ObjectId,ref:"Usuario",default:null},
 deletedAt:{type:Date,default:null,index:true}
},{timestamps:true,collection:"cerebro_evidencia_resultados"});
schema.index({empresaId:1,decisionId:1,ordenId:1},{unique:true});
module.exports=mongoose.models.CerebroEvidenciaResultado||mongoose.model("CerebroEvidenciaResultado",schema);