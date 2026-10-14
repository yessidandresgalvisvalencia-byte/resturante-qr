'use strict';
const mongoose=require('mongoose');
const schema=new mongoose.Schema({
 empresaId:{type:mongoose.Schema.Types.ObjectId,required:true,immutable:true},
 sedeId:{type:mongoose.Schema.Types.ObjectId,default:null,immutable:true},
 ventaId:{type:mongoose.Schema.Types.ObjectId,required:true,immutable:true},
 eventId:{type:String,required:true,immutable:true},
 importeCentavos:{type:Number,required:true,min:1,immutable:true},
 moneda:{type:String,required:true,enum:['COP'],immutable:true},
 fuente:{type:String,required:true,enum:['WOMPI_PEDIDO'],immutable:true}
},{collection:'gruk_ingresos_confirmados_p0',timestamps:true,versionKey:false,strict:'throw'});
schema.index({empresaId:1,ventaId:1},{unique:true,name:'uq_gruk_ingreso_por_venta'});
schema.index({empresaId:1,eventId:1},{unique:true,name:'uq_gruk_ingreso_por_evento'});
module.exports=mongoose.models.GrukIngresoConfirmado||mongoose.model('GrukIngresoConfirmado',schema);
