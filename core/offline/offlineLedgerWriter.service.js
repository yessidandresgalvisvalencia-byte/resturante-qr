"use strict";
// Append-only audit ledger event writer for later reviewed financial posting.
// Always invoked inside an existing Mongo transaction; never updates ledger entries.
const ULID=/^[0-9A-HJKMNP-TV-Z]{26}$/;
const ID=/^[A-Za-z0-9_-]{1,80}$/;
function error(code){const e=new Error(code);e.code=code;return e;}
async function appendOfflineLedgerEvent({db,session,context,eventId,movement}){
 if(!session||typeof session.inTransaction!=="function"||session.inTransaction()!==true)
   throw error("OFFLINE_LEDGER_TRANSACTION_REQUIRED");
 if(!db?.collection||!context||![context.empresaId,context.sedeId,context.actorId].every(v=>typeof v==="string"&&ID.test(v))||
   typeof eventId!=="string"||!ULID.test(eventId))throw error("OFFLINE_LEDGER_INVALID_CONTEXT");
 if(!movement||typeof movement.tipo!=="string"||!ID.test(movement.tipo)||
   typeof movement.montoCop!=="string"||!/^(0|[1-9][0-9]*)$/.test(movement.montoCop)||
   BigInt(movement.montoCop)>BigInt(Number.MAX_SAFE_INTEGER))throw error("OFFLINE_LEDGER_INVALID_MOVEMENT");
 const collection=db.collection("gruk_ledger_movimientos");
 const key={empresaId:context.empresaId,sedeId:context.sedeId,eventId,tipo:movement.tipo};
 const payload={...key,actorId:context.actorId,montoCop:movement.montoCop,deletedAt:null,createdAt:new Date()};
 // $setOnInsert never mutates an existing ledger entry.
 const result=await collection.updateOne(key,{$setOnInsert:payload},{upsert:true,session});
 if(result.upsertedCount!==1){
   const prior=await collection.findOne(key,{session,projection:{actorId:1,montoCop:1,deletedAt:1}});
   if(!prior||prior.actorId!==context.actorId||prior.montoCop!==movement.montoCop||prior.deletedAt!==null)
     throw error("OFFLINE_LEDGER_REPLAY_CONFLICT");
 }
 return Object.freeze({eventId,tipo:movement.tipo,inserted:result.upsertedCount===1});
}
module.exports={appendOfflineLedgerEvent};
