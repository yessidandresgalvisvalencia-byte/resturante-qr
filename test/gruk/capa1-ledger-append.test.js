"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {appendMovement,hashMovement,ZERO_HASH}=require("../../core/ledger/appendLedger.service");
function memoryDb(){
 let head=null;const entries=[];
 const heads={
  updateOne:async(key,update)=>{
   if(update.$setOnInsert){if(!head)head={...update.$setOnInsert};return {modifiedCount:head?1:0};}
   if(head.secuencia!==key.secuencia||head.lastHash!==key.lastHash)return {modifiedCount:0};
   Object.assign(head,update.$set);return {modifiedCount:1};
  },
  findOne:async()=>head
 };
 const movements={insertOne:async rec=>{entries.push(rec);},findOne:async key=>entries.find(e=>e.empresaId===key.empresaId&&e.sedeId===key.sedeId&&e.eventId===key.eventId)||null};
 const db={collection:n=>n==="gruk_ledger_heads"?heads:movements};
 const client={startSession:()=>({withTransaction:async cb=>cb(),endSession:async()=>{}})};
 return {db,client,entries,getHead:()=>head};
}
const input={empresaId:"A",sedeId:"s1",cuentaId:"caja1",eventId:"evt1",tipo:"CREDITO",amountCentavos:"101",actorId:"u1",ip:"127.0.0.1"};
test("ledger: maintains exact balance and hash chain",async()=>{
 const f=memoryDb();
 const first=await appendMovement({...f,...input});
 const second=await appendMovement({...f,...input,eventId:"evt2",tipo:"DEBITO",amountCentavos:"1"});
 assert.equal(first.beforeCentavos,"0");
 assert.equal(first.afterCentavos,"101");
 assert.equal(second.beforeCentavos,"101");
 assert.equal(second.afterCentavos,"100");
 assert.equal(first.hashAnterior,ZERO_HASH);
 assert.equal(second.hashAnterior,first.hash);
 assert.equal(first.hash,hashMovement(first));
 assert.equal(f.entries.length,2);
});
test("ledger: rejects amounts represented using floats",async()=>{
 const f=memoryDb();
 await assert.rejects(appendMovement({...f,...input,amountCentavos:10.5}),/LEDGER_INVALID_AMOUNT/);
 assert.equal(f.entries.length,0);
});
test("ledger: changing actor IP or timestamp invalidates hash",()=>{
 const f={empresaId:"A",sedeId:"s1",cuentaId:"caja",eventId:"e1",secuencia:1,tipo:"CREDITO",amountCentavos:"1",beforeCentavos:"0",afterCentavos:"1",actorId:"u",ip:"1.2.3.4",timestamp:new Date("2026-10-17T12:00:00Z"),hashAnterior:ZERO_HASH};
 assert.notEqual(hashMovement(f),hashMovement({...f,ip:"9.9.9.9"}));
 assert.notEqual(hashMovement(f),hashMovement({...f,timestamp:new Date("2026-10-17T12:01:00Z")}));
});

test("ledger: identical offline retry does not post a second movement",async()=>{
 const f=memoryDb();
 const first=await appendMovement({...f,...input});
 const retry=await appendMovement({...f,...input});
 assert.equal(retry.alreadyApplied,true);
 assert.equal(retry.hash,first.hash);
 assert.equal(f.entries.length,1);
 assert.equal(f.getHead().balanceCentavos,"101");
});
test("ledger: changed amount with reused eventId is rejected",async()=>{
 const f=memoryDb();await appendMovement({...f,...input});
 await assert.rejects(appendMovement({...f,...input,amountCentavos:"999"}),/LEDGER_EVENT_CONFLICT/);
 assert.equal(f.entries.length,1);
});

test("ledger: offline retry from a different IP is safe and idempotent",async()=>{
 const f=memoryDb();
 const first=await appendMovement({...f,...input});
 const retry=await appendMovement({...f,...input,ip:"10.0.0.2"});
 assert.equal(retry.alreadyApplied,true);
 assert.equal(f.entries.length,1);
 assert.equal(retry.ip,first.ip);
 assert.equal(f.getHead().balanceCentavos,"101");
});
test("ledger: duplicate event with changed account or actor cannot move balance",async()=>{
 const f=memoryDb();
 await appendMovement({...f,...input});
 await assert.rejects(appendMovement({...f,...input,cuentaId:"otraCaja"}),/LEDGER_EVENT_CONFLICT/);
 await assert.rejects(appendMovement({...f,...input,actorId:"otroUsuario"}),/LEDGER_EVENT_CONFLICT/);
 assert.equal(f.entries.length,1);
});
