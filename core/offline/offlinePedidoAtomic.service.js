"use strict";
// One Mongo transaction: claim the inbox event AND insert one pending order.
// No payment, inventory or ledger postings; not mounted on public routes.
const {ObjectId}=require("mongodb");
const {prepareOfflinePedido}=require("./offlinePedidoPreparation.service");
const ULID=/^[0-9A-HJKMNP-TV-Z]{26}$/;
function fail(code){const error=new Error(code);error.code=code;throw error;}
async function processPendingOfflinePedido({db,session,event,context}){
 if(!db?.collection||!session?.withTransaction)fail("OFFLINE_TRANSACTION_REQUIRED");
 if(!context||!["empresaId","sedeId","actorId"].every(k=>typeof context[k]==="string"&&context[k]))fail("OFFLINE_AUTH_REQUIRED");
 if(!event||!ULID.test(event.eventId||"")||event.tipo!=="PEDIDO_REGISTRADO"||
    event.empresaId!==context.empresaId||event.sedeId!==context.sedeId||event.actorId!==context.actorId)fail("OFFLINE_TENANT_MISMATCH");
 if(!ObjectId.isValid(context.empresaId))fail("OFFLINE_COMPANY_ID_INVALID");
 let response;
 await session.withTransaction(async()=>{
  const inbox=db.collection("gruk_offline_inbox");
  const key={empresaId:context.empresaId,sedeId:context.sedeId,actorId:context.actorId,eventId:event.eventId,tipo:"PEDIDO_REGISTRADO"};
  const entry=await inbox.findOne(key,{session});
  if(!entry)fail("OFFLINE_EVENT_NOT_FOUND");
  if(entry.status!=="PENDIENTE"){
   response={eventId:event.eventId,status:entry.status,created:false};
   return;
  }
  // The inbox is authoritative: never accept a different payload with a matching eventId.
  const {digest}=require("./offlineInbox.service");
  if(entry.eventHash!==digest(event))fail("OFFLINE_EVENT_CONFLICT");
  const prepared=await prepareOfflinePedido({db,session,event,context});
  const companyId=new ObjectId(context.empresaId);
  const orderKey={empresaId:companyId,sedeId:context.sedeId,offlineEventId:event.eventId};
  const insert={...prepared,empresaId:companyId,menuItemId:new ObjectId(prepared.menuItemId),
    productoServicioId:new ObjectId(prepared.productoServicioId),producto:"Pedido offline pendiente"};
  delete insert.requiresTransactionalInsert;
  const created=await db.collection("pedidos").updateOne(orderKey,{$setOnInsert:insert},{upsert:true,session});
  const changed=await inbox.updateOne({...key,status:"PENDIENTE"},{$set:{
    status:"EN_REVISION",reviewActorId:context.actorId,reviewStartedAt:new Date()
  }},{session});
  if(changed.modifiedCount!==1)fail("OFFLINE_CLAIM_CONFLICT");
  response={eventId:event.eventId,status:"EN_REVISION",created:created.upsertedCount===1,
    paymentPosted:false,inventoryPosted:false,ledgerPosted:false};
 });
 return response;
}
module.exports={processPendingOfflinePedido};
