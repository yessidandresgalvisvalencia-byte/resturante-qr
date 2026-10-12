'use strict';
const mongoose=require('mongoose');
const schema=new mongoose.Schema({
 empresaId:{type:mongoose.Schema.Types.ObjectId,required:true,immutable:true},
 consumidor:{type:String,required:true,immutable:true,trim:true,maxlength:80},
 eventId:{type:String,required:true,immutable:true,maxlength:180},
 procesadoAt:{type:Date,required:true,default:Date.now,immutable:true}
},{collection:'gruk_eventos_consumidos',strict:'throw',versionKey:false});
schema.index({empresaId:1,consumidor:1,eventId:1},{unique:true,name:'uq_gruk_consumidor_evento'});
module.exports=mongoose.models.GrukEventoConsumido||mongoose.model('GrukEventoConsumido',schema);
