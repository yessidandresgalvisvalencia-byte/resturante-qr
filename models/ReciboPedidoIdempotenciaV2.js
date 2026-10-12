'use strict';
const mongoose=require('mongoose');
const schema=new mongoose.Schema({
 restaurantId:{type:String,required:true,immutable:true},
 sedeId:{type:String,required:true,immutable:true},
 key:{type:String,required:true,immutable:true},
 intentDigest:{type:String,required:true,immutable:true},
 payloadDigest:{type:String,required:true,immutable:true},
 pedidoId:{type:mongoose.Schema.Types.ObjectId,ref:'Pedido',required:true,immutable:true}
},{timestamps:true,versionKey:false,collection:'gruk_recibos_pedido_v2'});
schema.index({restaurantId:1,sedeId:1,key:1},{unique:true,name:'uq_gruk_pedido_v2_scope_key'});
module.exports=mongoose.models.ReciboPedidoIdempotenciaV2||mongoose.model('ReciboPedidoIdempotenciaV2',schema);
