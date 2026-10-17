"use strict";
// Internal transaction boundary, not connected to API routes or payments.
const {prepareOfflinePedido}=require("./offlinePedidoPreparation.service");
function fail(code){const e=new Error(code);e.code=code;throw e;}
async function insertOfflinePedido({event,context,db,session}){
 if(!db?.collection||!session?.withTransaction)fail("OFFLINE_TRANSACTION_REQUIRED");
 let answer;
 await session.withTransaction(async()=>{
  const prepared=await prepareOfflinePedido({event,context,db,session});
  const {ObjectId}=require("mongodb");
  const companyId=new ObjectId(prepared.empresaId);
  const filter={empresaId:companyId,sedeId:prepared.sedeId,offlineEventId:prepared.offlineEventId};
  const coll=db.collection("pedidos");
  const payload={...prepared,empresaId:companyId,menuItemId:new ObjectId(prepared.menuItemId),
   productoServicioId:new ObjectId(prepared.productoServicioId),producto:"Pedido offline pendiente",
   estado:"pendiente",estadoPago:"pendiente"};
  delete payload.requiresTransactionalInsert;
  const result=await coll.updateOne(filter,{$setOnInsert:payload},{upsert:true,session});
  answer={offlineEventId:prepared.offlineEventId,created:result.upsertedCount===1,paymentPosted:false,inventoryPosted:false};
 });
 return answer;
}
module.exports={insertOfflinePedido};
