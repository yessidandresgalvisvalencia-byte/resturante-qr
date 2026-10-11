'use strict';
const axios=require('axios');
const {randomUUID}=require('node:crypto');
const IntentoPagoPedido=require('../../models/IntentoPagoPedido');
const {confirmarPagoPedidoWompi}=require('../pagosPedidos.service');
const {isP0PedidoEnabled}=require('./pedidoFeatureFlag');

function crearConciliadorWompi({
 IntentoModel=IntentoPagoPedido,
 consultar=async id=>{
  const response=await axios.get('https://production.wompi.co/v1/transactions/'+encodeURIComponent(id),{timeout:10000});
  return response.data?.data;
 },
 confirmar=confirmarPagoPedidoWompi,
 habilitado=isP0PedidoEnabled
}={}){
 return async function conciliarPendientes({restaurantId,limit=20,io=null}={}){
  if(typeof restaurantId!=='string'||!restaurantId.trim()||!habilitado({restaurantId}))
   throw new Error('CONCILIACION_P0_NO_HABILITADA');
  if(!Number.isSafeInteger(limit)||limit<1||limit>100)throw new Error('CONCILIACION_LIMITE_INVALIDO');
  // No payment initiation or lookups by unverified reference. Only stored gateway IDs.
  const pendientes=await IntentoModel.find({
   restaurantId,estado:{$in:['CREADO','PENDIENTE','RECHAZADO']},
   transactionId:{$type:'string',$ne:''}
  }).sort({updatedAt:1}).limit(limit).lean();
  const resultado={checked:0,approved:0,unchanged:0,failed:0};
  for(const intento of pendientes){
   const now=new Date();
   const token=randomUUID();
   const claimed=await IntentoModel.findOneAndUpdate({
    _id:intento._id,restaurantId,estado:{$in:['CREADO','PENDIENTE','RECHAZADO']},
    transactionId:intento.transactionId,
    $or:[{conciliacionLeaseUntil:null},{conciliacionLeaseUntil:{$lte:now}}]
   },{$set:{conciliacionLeaseUntil:new Date(now.getTime()+60000),conciliacionToken:token}}, {new:true});
   if(!claimed)continue;
   resultado.checked++;
   try{
    const transaction=await consultar(intento.transactionId);
    if(!transaction||String(transaction.id)!==intento.transactionId||
       String(transaction.reference)!==intento.reference){
      resultado.failed++;
      continue;
    }
    // A slow provider response must not settle a payment after its lease
    // expired or was reclaimed by another worker.
    const lease=await IntentoModel.findOne({
     _id:intento._id,restaurantId,conciliacionToken:token,
     conciliacionLeaseUntil:{$gt:new Date()}
    }).lean();
    if(!lease){resultado.failed++;continue;}
    const applied=await confirmar({transaction,io});
    if(!applied?.handled||!applied.ok){resultado.failed++;continue;}
    if(applied.estado==='APROBADO')resultado.approved++;
    else resultado.unchanged++;
   }catch(error){
    resultado.failed++;
    console.error('[GRUK P0 CONCILIACION] Fallo recuperable',{reference:intento.reference,error:String(error.message).slice(0,180)});
   }finally{
    await IntentoModel.updateOne({_id:intento._id,conciliacionToken:token},{$set:{conciliacionLeaseUntil:null,conciliacionToken:null}});
   }
  }
  return resultado;
 };
}
module.exports={crearConciliadorWompi};
