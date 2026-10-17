"use strict";
// Internal processor: reads the immutable stored event, never accepts a client-supplied payload.
// Explicitly invoked by trusted backend only. No payment, stock or ledger posting.
const {processPendingOfflinePedido}=require("./offlinePedidoAtomic.service");
const KEYS=["eventId","empresaId","sedeId","actorId","deviceId","tipo","occurredAt","schemaVersion","payload"];
function fail(code){const err=new Error(code);err.code=code;throw err;}
async function processStoredOfflinePedido({db,client,context,eventId}){
 if(!db?.collection||!client?.startSession)fail("OFFLINE_DB_REQUIRED");
 if(!context||!["empresaId","sedeId","actorId"].every(k=>typeof context[k]==="string"&&k))
  fail("OFFLINE_AUTH_REQUIRED");
 if(typeof eventId!=="string"||!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(eventId))fail("OFFLINE_INVALID_IDS");
 const record=await db.collection("gruk_offline_inbox").findOne({
  empresaId:context.empresaId,sedeId:context.sedeId,actorId:context.actorId,
  eventId,tipo:"PEDIDO_REGISTRADO"
 });
 if(!record)fail("OFFLINE_EVENT_NOT_FOUND");
 const event={};
 for(const key of KEYS)event[key]=record[key];
 const session=client.startSession();
 try{return await processPendingOfflinePedido({db,session,event,context});}
 finally{await session.endSession();}
}
module.exports={processStoredOfflinePedido};
