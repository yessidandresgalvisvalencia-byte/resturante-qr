'use strict';
const mongoose=require('mongoose');
const schema=new mongoose.Schema({
 eventId:{type:String,required:true,immutable:true},
 empresaId:{type:mongoose.Schema.Types.ObjectId,required:true,index:true,immutable:true},
 sedeId:{type:mongoose.Schema.Types.ObjectId,default:null,immutable:true},
 eventName:{type:String,enum:['PEDIDO_CREADO','PEDIDO_ACTUALIZADO','VENTA_COMPLETADA'],required:true,immutable:true},
 aggregateId:{type:mongoose.Schema.Types.ObjectId,required:true,immutable:true},
 payload:{type:mongoose.Schema.Types.Mixed,required:true,immutable:true},
 status:{type:String,enum:['PENDING','CLAIMED','DONE'],default:'PENDING',index:true},
 attempts:{type:Number,default:0,min:0},
 nextAttemptAt:{type:Date,default:Date.now,index:true},
 leaseUntil:{type:Date,default:null},
 claimedBy:{type:String,default:null},
 dispatchedAt:{type:Date,default:null},
 lastError:{type:String,default:''}
},{timestamps:true,strict:'throw'});
schema.index({eventId:1},{unique:true});
schema.index({status:1,nextAttemptAt:1,leaseUntil:1});
module.exports=mongoose.models.GrukOutbox||mongoose.model('GrukOutbox',schema);
