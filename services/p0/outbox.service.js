'use strict';
const crypto=require('crypto');
const mongoose=require('mongoose');
const Outbox=require('../../models/GrukOutbox');
const EVENT_SOCKET=Object.freeze({PEDIDO_CREADO:'pedido:nuevo',PEDIDO_ACTUALIZADO:'pedido:actualizado',VENTA_COMPLETADA:'venta:completada'});
function validateEvent(input){
 if(!input||!Object.hasOwn(EVENT_SOCKET,input.eventName))throw new Error('OUTBOX_EVENTO_INVALIDO');
 if(!mongoose.isValidObjectId(input.empresaId)||!mongoose.isValidObjectId(input.aggregateId))throw new Error('OUTBOX_IDENTIDAD_INVALIDA');
 if(input.sedeId!=null&&!mongoose.isValidObjectId(input.sedeId))throw new Error('OUTBOX_SEDE_INVALIDA');
 if(!input.payload||typeof input.payload!=='object'||Array.isArray(input.payload))throw new Error('OUTBOX_PAYLOAD_INVALIDO');
 if(!input.eventId||!/^[-_a-zA-Z0-9:]{8,180}$/.test(input.eventId))throw new Error('OUTBOX_ID_INVALIDO');
}
async function registrarEventoEnTransaccion(input,session){
 if(!session||!session.inTransaction())throw new Error('OUTBOX_TRANSACCION_OBLIGATORIA');
 validateEvent(input);
 const [event]=await Outbox.create([{eventId:input.eventId,empresaId:input.empresaId,sedeId:input.sedeId||null,eventName:input.eventName,aggregateId:input.aggregateId,payload:input.payload}],{session});
 return event;
}
async function publicarLote({io,workerId=crypto.randomUUID(),limit=50,now=new Date()}={}){
 if(!io||typeof io.to!=='function')throw new Error('OUTBOX_SOCKET_NO_DISPONIBLE');
 if(!Number.isInteger(limit)||limit<1||limit>100)throw new Error('OUTBOX_LIMITE_INVALIDO');
 let sent=0,failed=0;
 for(let n=0;n<limit;n++){
  const leaseUntil=new Date(Date.now()+60000);
  const claimToken=crypto.randomUUID();
  const evt=await Outbox.findOneAndUpdate({nextAttemptAt:{$lte:now},$or:[{status:'PENDING'},{status:'CLAIMED',leaseUntil:{$lte:now}}]},{$set:{status:'CLAIMED',leaseUntil,claimedBy:workerId,claimToken},$inc:{attempts:1}},{sort:{createdAt:1},new:true});
  if(!evt)break;
  try{
   validateEvent(evt);
   const target=io.to('empresa-'+evt.empresaId.toString());
   if(!target||typeof target.emit!=='function')throw new Error('OUTBOX_ROOM_INVALIDO');
   target.emit(EVENT_SOCKET[evt.eventName],{eventId:evt.eventId,empresaId:String(evt.empresaId),sedeId:evt.sedeId?String(evt.sedeId):null,aggregateId:String(evt.aggregateId),data:evt.payload});
   const updated=await Outbox.updateOne({_id:evt._id,status:'CLAIMED',claimedBy:workerId,claimToken},{$set:{status:'DONE',dispatchedAt:new Date(),leaseUntil:null,claimedBy:null,claimToken:null,lastError:''}});
   if(updated.modifiedCount!==1)throw new Error('OUTBOX_ACK_PERDIDO');
   sent++;
  }catch(err){
   failed++;
   const delay=Math.min(300000,1000*2**Math.min(evt.attempts,8));
   await Outbox.updateOne({_id:evt._id,status:'CLAIMED',claimedBy:workerId,claimToken},{$set:{status:'PENDING',nextAttemptAt:new Date(Date.now()+delay),leaseUntil:null,claimedBy:null,claimToken:null,lastError:String(err.message).slice(0,300)}});
  }
 }
 return {sent,failed};
}
module.exports={registrarEventoEnTransaccion,publicarLote,validateEvent,EVENT_SOCKET};
