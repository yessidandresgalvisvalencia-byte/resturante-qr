'use strict';
const IntentoPagoPedido=require('../../models/IntentoPagoPedido');
const {isP0PedidoEnabled}=require('./pedidoFeatureFlag');
const {MAX_INTENTOS_AUTOMATICOS}=require('./conciliarPendientesWompi');

async function obtenerPendientesRevisionWompi({
 restaurantId,limite=50,
 IntentoModel=IntentoPagoPedido,
 habilitado=isP0PedidoEnabled
}={}){
 if(typeof restaurantId!=='string'||!restaurantId.trim()||!habilitado({restaurantId}))
  throw new Error('REVISION_WOMPI_NO_HABILITADA');
 if(!Number.isSafeInteger(limite)||limite<1||limite>100)
  throw new Error('REVISION_WOMPI_LIMITE_INVALIDO');
 const filtro={
  restaurantId,
  estado:{$in:['CREADO','PENDIENTE','RECHAZADO']},
  $or:[
   {transactionId:{$in:['',null]}},
   {conciliacionIntentos:{$gte:MAX_INTENTOS_AUTOMATICOS}}
  ]
 };
 const items=await IntentoModel.find(filtro)
  .select('reference transactionId estado conciliacionIntentos updatedAt -_id')
  .sort({updatedAt:1}).limit(limite).lean();
 return items.map(item=>Object.freeze({
  reference:item.reference,
  estado:item.estado,
  razon:!item.transactionId?'TRANSACCION_ID_AUSENTE':'REINTENTOS_AGOTADOS',
  intentos:Number.isSafeInteger(item.conciliacionIntentos)?item.conciliacionIntentos:0,
  updatedAt:item.updatedAt||null
 }));
}
module.exports={obtenerPendientesRevisionWompi};
