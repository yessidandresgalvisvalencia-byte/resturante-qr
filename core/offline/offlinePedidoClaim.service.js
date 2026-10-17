"use strict";
// Atomically claim a received offline order for controlled processing.
// Claim is NOT posting and does not mark payment, stock, or ledger.
function error(code){const e=new Error(code);e.code=code;return e;}
const ULID=/^[0-9A-HJKMNP-TV-Z]{26}$/;
async function claimReceivedPedido({db,context,eventId,session}){
 if(!db?.collection || !session || typeof session.withTransaction!=="function")throw error("OFFLINE_TRANSACTION_REQUIRED");
 if(!context||!["empresaId","sedeId","actorId"].every(k=>typeof context[k]==="string"&&context[k]))
  throw error("OFFLINE_AUTH_REQUIRED");
 if(typeof eventId!=="string"||!ULID.test(eventId))throw error("OFFLINE_INVALID_IDS");
 let outcome;
 await session.withTransaction(async()=>{
  const inbox=db.collection("gruk_offline_inbox");
  const filter={empresaId:context.empresaId,sedeId:context.sedeId,actorId:context.actorId,eventId,
   tipo:"PEDIDO_REGISTRADO",status:"PENDIENTE"};
  const updated=await inbox.findOneAndUpdate(filter,{$set:{
   status:"EN_REVISION",reviewActorId:context.actorId,reviewStartedAt:new Date()
  }},{session,returnDocument:"after"});
  if(updated){outcome={eventId,status:"EN_REVISION"};return;}
  const prior=await inbox.findOne({empresaId:context.empresaId,sedeId:context.sedeId,
   actorId:context.actorId,eventId},{session,projection:{status:1,tipo:1,_id:0}});
  outcome=prior?.tipo==="PEDIDO_REGISTRADO"?{eventId,status:prior.status}:{eventId,status:"NO_ENCONTRADO"};
 });
 return outcome;
}
module.exports={claimReceivedPedido};
