"use strict";
const mongoose=require("mongoose");
const ordenSchema=new mongoose.Schema({departamento:{type:String,required:true,enum:["DIRECCION","OPERACIONES","VENTAS","FINANZAS","MARKETING","GENTE","SERVICIO_CLIENTE"]},tarea:{type:String,required:true},prioridad:{type:String,enum:["BAJA","MEDIA","ALTA","CRITICA"],default:"MEDIA"},responsableId:{type:mongoose.Schema.Types.ObjectId,ref:"Usuario",default:null},deadline:{type:Date,default:null},kpi_a_medir:{type:String,required:true},automatizable:{type:Boolean,default:false},estado:{type:String,enum:["PENDIENTE_APROBACION","APROBADA","RECHAZADA","EJECUTADA","SUPERADA"],default:"PENDIENTE_APROBACION"},aprobadaPor:{type:mongoose.Schema.Types.ObjectId,ref:"Usuario",default:null},aprobadaAt:{type:Date,default:null},superadaAt:{type:Date,default:null},superadaPorDecisionId:{type:mongoose.Schema.Types.ObjectId,ref:"CerebroDecision",default:null}},{_id:true});
const cobroPrioritarioSchema=new mongoose.Schema({
 ventaId:{type:mongoose.Schema.Types.ObjectId,ref:"Venta",default:null},
 descripcion:{type:String,default:"",maxlength:300},
 monto:{type:Number,required:true,min:0},
 fechaVencimiento:{type:Date,default:null},
 clasificacion:{type:String,enum:["VENCIDA","PROXIMOS_7_DIAS"],required:true}
},{_id:false});
const contextoFinancieroSchema=new mongoose.Schema({
 fuente:{type:String,enum:["TESORERIA_GRUK"],default:"TESORERIA_GRUK"},
 estado7d:{type:String,default:null},
 confiabilidad:{type:String,default:null},
 saldoActual:{type:Number,default:null},
 obligaciones7d:{type:Number,default:0,min:0},
 cobros7d:{type:Number,default:0,min:0},
 faltanteConCajaActual:{type:Number,default:0,min:0},
 faltanteAunCobrandoTodo:{type:Number,default:0,min:0},
 montoCobrosPriorizados:{type:Number,default:0,min:0},
 faltanteDespuesCobrosPriorizados:{type:Number,default:0,min:0},
 cobrosPriorizados:{type:[cobroPrioritarioSchema],default:[]},
 fechaCritica:{type:Date,default:null}
},{_id:false});
const schema=new mongoose.Schema({empresaId:{type:mongoose.Schema.Types.ObjectId,ref:"Empresa",required:true,index:true},sedeId:{type:mongoose.Schema.Types.ObjectId,ref:"Sede",default:null,index:true},decisionFingerprint:{type:String,default:null,index:true,maxlength:64},decision_general:{situacion:{type:String,required:true},causa_raiz:{type:String,required:true},prediccion:{type:String,required:true}},ordenes_por_departamento:{type:[ordenSchema],default:[]},contexto_financiero:{type:contextoFinancieroSchema,default:null},confianza_global:{type:Number,required:true,min:0,max:100},riesgo_si_no_se_hace:{type:String,required:true},como_medir_exito_en_7_dias:{type:String,required:true},reportesOrigen:[{type:mongoose.Schema.Types.ObjectId,ref:"CerebroReporteNeurona"}],createdBy:{type:mongoose.Schema.Types.ObjectId,ref:"Usuario",default:null},deletedAt:{type:Date,default:null,index:true}},{timestamps:true,collection:"cerebro_decisiones"});
schema.index({empresaId:1,createdAt:-1});
schema.index({empresaId:1,decisionFingerprint:1,createdAt:-1});
module.exports=mongoose.models.CerebroDecision||mongoose.model("CerebroDecision",schema);
