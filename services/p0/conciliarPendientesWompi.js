'use strict';
const axios=require('axios');
const {randomUUID}=require('node:crypto');
const IntentoPagoPedido=require('../../models/IntentoPagoPedido');
const {confirmarPagoPedidoWompi}=require('../pagosPedidos.service');
const {isP0PedidoEnabled}=require('./pedidoFeatureFlag');

const MAX_INTENTOS_AUTOMATICOS=12;
function calcularReintentoMs(intentos){
 const exponent=Math.min(Math.max(0,intentos-1),6);
 return Math.min(3600000,30000*(2**exponent));
}
const CODIGOS_CONFIRMACION=new Set(['INTENTO_NO_ENCONTRADO','INTENTO_ESTADO_CONFLICTIVO','TRANSACCION_REFERENCIA_CONFLICTIVA','INTEGRIDAD_ECONOMICA_INVALIDA','TRANSACCION_ID_INVALIDO','ESTADO_WOMPI_DESCONOCIDO','CONCILIACION_RESERVA_PERDIDA']);
function codigoConfirmacion(reason){return CODIGOS_CONFIRMACION.has(reason)?reason:'CONFIRMACION_FALLIDA';}
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
   transactionId:{$type:'string',$ne:''},
   conciliacionIntentos:{$not:{$gte:MAX_INTENTOS_AUTOMATICOS}},
   $or:[{conciliacionReintentoAt:null},{conciliacionReintentoAt:{$lte:new Date()}}]
  }).sort({updatedAt:1}).limit(limit).lean();
  const resultado={checked:0,approved:0,unchanged:0,failed:0};
  for(const intento of pendientes){
   const now=new Date();
   const token=randomUUID();
   let claimed;
   try{claimed=await IntentoModel.findOneAndUpdate({
    _id:intento._id,restaurantId,estado:{$in:['CREADO','PENDIENTE','RECHAZADO']},
    transactionId:intento.transactionId,
    conciliacionIntentos:{$not:{$gte:MAX_INTENTOS_AUTOMATICOS}},
    $and:[
     {$or:[{conciliacionLeaseUntil:null},{conciliacionLeaseUntil:{$lte:now}}]},
     {$or:[{conciliacionReintentoAt:null},{conciliacionReintentoAt:{$lte:now}}]}
    ]
   },{$set:{conciliacionLeaseUntil:new Date(now.getTime()+60000),conciliacionToken:token}}, {new:true});
   }catch(_error){
    resultado.failed++;
    console.error('[GRUK P0 CONCILIACION] No se pudo reservar intento',{codigo:'RESERVA_PERSISTENCIA_ERROR'});
    continue;
   }
   if(!claimed)continue;
   // A concurrent update may change payment economics between the scan and claim.
   // Fail closed using the atomic claim snapshot rather than stale scan values.
   const intentoVigente=claimed;
   resultado.checked++;
   let errorCode=null;
   let settled=false;
   try{
    const transaction=await consultar(intentoVigente.transactionId);
    if(!transaction||String(transaction.id)!==intentoVigente.transactionId||
       String(transaction.reference)!==intentoVigente.reference||
       !Number.isSafeInteger(transaction.amount_in_cents)||
       transaction.amount_in_cents!==intentoVigente.amountInCents||
       String(transaction.currency||'').toUpperCase()!==intentoVigente.currency||
       !['PENDING','APPROVED','DECLINED','ERROR','VOIDED'].includes(String(transaction.status||'').toUpperCase())){
      resultado.failed++;
      errorCode='RESPUESTA_WOMPI_INCONSISTENTE';
      continue;
    }
    // A slow provider response must not settle a payment after its lease
    // expired or was reclaimed by another worker.
    const lease=await IntentoModel.findOne({
     _id:intento._id,restaurantId,conciliacionToken:token,
     conciliacionLeaseUntil:{$gt:new Date()}
    }).lean();
    if(!lease){resultado.failed++;errorCode='RESERVA_PERDIDA';continue;}
    const applied=await confirmar({transaction,io,conciliacionToken:token});
    if(!applied?.handled||!applied.ok){resultado.failed++;errorCode=codigoConfirmacion(applied?.reason);continue;}
    if(applied.estado==='APROBADO')resultado.approved++;
    else resultado.unchanged++;
    settled=applied.estado==='APROBADO';
   }catch(error){
    resultado.failed++;
    errorCode='CONSULTA_O_CONFIRMACION_ERROR';
    console.error('[GRUK P0 CONCILIACION] Fallo recuperable',{codigo:errorCode});
   }finally{
    const intentos=Number.isSafeInteger(intento.conciliacionIntentos)?intento.conciliacionIntentos+1:1;
    try{
     await IntentoModel.updateOne({_id:intento._id,conciliacionToken:token},{$set:{
     conciliacionLeaseUntil:null,conciliacionToken:null,
     conciliacionReintentoAt:settled?null:new Date(Date.now()+calcularReintentoMs(intentos)),
     conciliacionUltimoError:errorCode,
     conciliacionIntentos:intentos
    }});
    }catch(_error){
     resultado.failed++;
     console.error('[GRUK P0 CONCILIACION] Fallo guardando reintento',{codigo:'REINTENTO_PERSISTENCIA_ERROR'});
     // The lease expires in MongoDB; the next worker can reclaim it safely.
    }
   }
  }
  return resultado;
 };
}
module.exports={crearConciliadorWompi,calcularReintentoMs,codigoConfirmacion,MAX_INTENTOS_AUTOMATICOS};
