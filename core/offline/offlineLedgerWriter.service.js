"use strict";
// Append-only audit ledger event writer for later reviewed financial posting.
// Always invoked inside an existing Mongo transaction; never updates ledger entries.
const ULID=/^[0-9A-HJKMNP-TV-Z]{26}$/;
const ID=/^[A-Za-z0-9_-]{1,80}$/;
function error(code){const e=new Error(code);e.code=code;return e;}
function own(record,key,code){
 if(!record||typeof record!=="object"||Array.isArray(record))throw error(code);
 const descriptor=Object.getOwnPropertyDescriptor(record,key);
 if(!descriptor||!("value" in descriptor))throw error(code);
 return descriptor.value;
}
async function appendOfflineLedgerEvent({db,session,context,eventId,movement}){
 if(!session||typeof session.inTransaction!=="function"||session.inTransaction()!==true)
   throw error("OFFLINE_LEDGER_TRANSACTION_REQUIRED");
 const identity={};
 for(const field of ["empresaId","sedeId","actorId"]){
   const value=own(context,field,"OFFLINE_LEDGER_INVALID_CONTEXT");
   if(typeof value!=="string"||!ID.test(value))throw error("OFFLINE_LEDGER_INVALID_CONTEXT");
   identity[field]=value;
 }
 if(typeof eventId!=="string"||!ULID.test(eventId))throw error("OFFLINE_LEDGER_INVALID_CONTEXT");
 const tipo=own(movement,"tipo","OFFLINE_LEDGER_INVALID_MOVEMENT");
 const montoCop=own(movement,"montoCop","OFFLINE_LEDGER_INVALID_MOVEMENT");
 if(typeof tipo!=="string"||!ID.test(tipo)||
    typeof montoCop!=="string"||montoCop.length>16||
    !/^(0|[1-9][0-9]*)$/.test(montoCop)||
    BigInt(montoCop)>BigInt(Number.MAX_SAFE_INTEGER))
   throw error("OFFLINE_LEDGER_INVALID_MOVEMENT");
 if(!db||typeof db.collection!=="function")throw error("OFFLINE_LEDGER_INVALID_CONTEXT");
 const collection=db.collection("gruk_ledger_movimientos");
 // Refuse to write before Mongo has confirmed the unique index exists.
 if(typeof collection.indexes!=="function")throw error("OFFLINE_LEDGER_UNIQUE_INDEX_REQUIRED");
 const indexes=await collection.indexes();
 const valid=Array.isArray(indexes)&&indexes.some(index=>
   index&&typeof index==="object"&&index.name==="uniq_offline_ledger_event_type_tenant"&&index.unique===true&&index.sparse!==true&&!index.partialFilterExpression&&
   Object.keys(index.key||{}).length===4&&
   ["empresaId","sedeId","eventId","tipo"].every((k,i)=>Object.keys(index.key)[i]===k&&index.key[k]===1));
 if(!valid)throw error("OFFLINE_LEDGER_UNIQUE_INDEX_REQUIRED");
 const key={empresaId:identity.empresaId,sedeId:identity.sedeId,eventId,tipo};
 const payload={...key,actorId:identity.actorId,montoCop,deletedAt:null,createdAt:new Date()};
 // $setOnInsert never mutates an existing ledger entry.
 let inserted=false;
 try {
   const result=await collection.updateOne(key,{$setOnInsert:payload},{upsert:true,session});
   // Mongo must explicitly attest an insert or an existing matching entry.
   // Missing/malformed acknowledgements must not be treated as replay success.
   if(!result||result.acknowledged!==true||!Number.isInteger(result.upsertedCount)||
      (result.upsertedCount!==0&&result.upsertedCount!==1))
     throw error("OFFLINE_LEDGER_WRITE_UNVERIFIED");
   inserted=result.upsertedCount===1;
 } catch(err) {
   // E11000 inside Mongo transaction can abort the session: do not query/retry here.
   // Caller must retry in a fresh transaction and compare the committed entry.
   if(err?.code===11000)throw error("OFFLINE_LEDGER_CONCURRENT_RETRY_REQUIRED");
   throw err;
 }
 if(!inserted){
   const prior=await collection.findOne(key,{session,projection:{empresaId:1,sedeId:1,eventId:1,tipo:1,actorId:1,montoCop:1,deletedAt:1}});
   const fields=["empresaId","sedeId","eventId","tipo","actorId","montoCop","deletedAt"];
   const priorSnapshot={};
   if(!prior||typeof prior!=="object"||Array.isArray(prior))
     throw error("OFFLINE_LEDGER_REPLAY_CONFLICT");
   for(const field of fields)
     priorSnapshot[field]=own(prior,field,"OFFLINE_LEDGER_REPLAY_CONFLICT");
   if(priorSnapshot.empresaId!==key.empresaId||priorSnapshot.sedeId!==key.sedeId||
      priorSnapshot.eventId!==key.eventId||priorSnapshot.tipo!==key.tipo||
      priorSnapshot.actorId!==identity.actorId||priorSnapshot.montoCop!==montoCop||
      priorSnapshot.deletedAt!==null)
     throw error("OFFLINE_LEDGER_REPLAY_CONFLICT");
 }
 return Object.freeze({eventId,tipo,inserted});
}
module.exports={appendOfflineLedgerEvent};
