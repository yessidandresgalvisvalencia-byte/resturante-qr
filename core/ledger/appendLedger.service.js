"use strict";
// Isolated append-only financial journal. Requires MongoDB replica set transactions.
// No routes call this service yet; legacy balances are not migrated.
const {createHash}=require("node:crypto");
const {calculateMovement,parseBalance}=require("./copAmounts");
const ZERO_HASH="0".repeat(64);
function required(value,name) {
 if(typeof value!=="string" || !/^[A-Za-z0-9_-]{1,80}$/.test(value)) throw new TypeError("LEDGER_INVALID_"+name);
 return value;
}
function hashMovement(e) {
 const fields=["empresaId","sedeId","cuentaId","eventId","secuencia","tipo","amountCentavos","beforeCentavos","afterCentavos","actorId","ip","timestamp","hashAnterior"];
 return createHash("sha256").update(JSON.stringify(fields.map(k=>k==="timestamp" ? new Date(e[k]).toISOString() : e[k]))).digest("hex");
}
async function ensureLedgerIndexes(db) {
 await db.collection("gruk_ledger_movimientos").createIndex({empresaId:1,sedeId:1,cuentaId:1,secuencia:1},{unique:true,name:"unique_ledger_sequence"});
 await db.collection("gruk_ledger_movimientos").createIndex({empresaId:1,sedeId:1,eventId:1},{unique:true,name:"unique_ledger_event"});
 await db.collection("gruk_ledger_heads").createIndex({empresaId:1,sedeId:1,cuentaId:1},{unique:true,name:"unique_ledger_head"});
}
async function appendMovement({client,db,empresaId,sedeId,cuentaId,eventId,tipo,amountCentavos,actorId,ip}) {
 for (const [name,value] of Object.entries({empresaId,sedeId,cuentaId,eventId,actorId})) required(value,name);
 if(typeof ip!=="string" || ip.length<1 || ip.length>100) throw new TypeError("LEDGER_INVALID_IP");
 // Validate BEFORE entering transaction, including amount type.
 calculateMovement({beforeCentavos:"0",amountCentavos,tipo});
 if(!client?.startSession || !db?.collection) throw new TypeError("LEDGER_DB_REQUIRED");
 const session=client.startSession();
 try {
   let inserted;
   await session.withTransaction(async()=>{
     const heads=db.collection("gruk_ledger_heads");
     const movements=db.collection("gruk_ledger_movimientos");
     const key={empresaId,sedeId,cuentaId};
     // Guard first creation against concurrent transactions.
     await heads.updateOne(key,{$setOnInsert:{...key,secuencia:0,balanceCentavos:"0",lastHash:ZERO_HASH}},{upsert:true,session});
     const head=await heads.findOne(key,{session});
     if(!head || !Number.isSafeInteger(head.secuencia)) throw new Error("LEDGER_CORRUPT_HEAD");
     parseBalance(head.balanceCentavos);
     const next=calculateMovement({beforeCentavos:head.balanceCentavos,amountCentavos,tipo});
     const record={...key,eventId,secuencia:head.secuencia+1,tipo,amountCentavos:next.amountCentavos,beforeCentavos:next.beforeCentavos,afterCentavos:next.afterCentavos,actorId,ip,hashAnterior:head.lastHash,timestamp:new Date(),deletedAt:null};
     record.hash=hashMovement(record);
     const update=await heads.updateOne({...key,secuencia:head.secuencia,lastHash:head.lastHash},{$set:{secuencia:record.secuencia,balanceCentavos:record.afterCentavos,lastHash:record.hash}},{session});
     if(update.modifiedCount!==1) throw new Error("LEDGER_CONCURRENT_WRITE");
     await movements.insertOne(record,{session});
     inserted=record;
   },{readConcern:{level:"snapshot"},writeConcern:{w:"majority"}});
   return inserted;
 } finally {await session.endSession();}
}
module.exports={appendMovement,ensureLedgerIndexes,hashMovement,ZERO_HASH};
