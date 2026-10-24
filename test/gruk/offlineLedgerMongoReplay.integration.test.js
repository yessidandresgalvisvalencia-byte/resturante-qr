"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {appendOfflineLedgerEvent:append}=require("../../core/offline/offlineLedgerWriter.service");

test("Capa 2 Mongo real: ledger idempotente con transacciones, conflicto y aislamiento tenant",
 {skip:!process.env.GRUK_TEST_MONGO_URI,timeout:120000},async()=>{
 const {MongoClient}=require("mongodb");
 const client=new MongoClient(process.env.GRUK_TEST_MONGO_URI,{serverSelectionTimeoutMS:10000});
 const name="gruk_ledger_replay_"+process.pid+"_"+Date.now();
 const context={empresaId:"empresaA",sedeId:"sede1",actorId:"cajeroA"};
 const other={empresaId:"empresaB",sedeId:"sede1",actorId:"cajeroB"};
 const eventId="01ARZ3NDEKTSV4RRFFQ69G5FA0";
 const movement={tipo:"VENTA_OFFLINE",montoCop:"3500"};
 let connected=false;
 try{
  await client.connect();connected=true;
  const db=client.db(name),ledger=db.collection("gruk_ledger_movimientos");
  await ledger.createIndex({empresaId:1,sedeId:1,eventId:1,tipo:1},
   {unique:true,name:"uniq_offline_ledger_event_type_tenant"});
  async function execute(ctx,amount=movement.montoCop){
   const session=client.startSession();
   try{
    let response;
    await session.withTransaction(async()=>{
     response=await append({db,session,context:ctx,eventId,
      movement:{...movement,montoCop:amount}});
    });
    return response;
   }finally{await session.endSession();}
  }
  assert.deepEqual(await execute(context),{eventId,tipo:"VENTA_OFFLINE",inserted:true});
  for(let i=0;i<5;i++)
   assert.deepEqual(await execute(context),{eventId,tipo:"VENTA_OFFLINE",inserted:false});
  assert.equal(await ledger.countDocuments({empresaId:"empresaA",sedeId:"sede1"}),1);
  await assert.rejects(execute(context,"3501"),{code:"OFFLINE_LEDGER_REPLAY_CONFLICT"});
  await assert.rejects(execute({...context,actorId:"otroCajero"}),{code:"OFFLINE_LEDGER_REPLAY_CONFLICT"});
  assert.equal(await ledger.countDocuments({empresaId:"empresaA",sedeId:"sede1"}),1);
  assert.deepEqual(await execute(other),{eventId,tipo:"VENTA_OFFLINE",inserted:true});
  assert.equal(await ledger.countDocuments({}),2);
  const docs=await ledger.find({},{projection:{_id:0,empresaId:1,actorId:1,montoCop:1,deletedAt:1}}).toArray();
  assert.deepEqual(docs.map(x=>x.empresaId).sort(),["empresaA","empresaB"]);
  assert(docs.every(x=>x.montoCop==="3500"&&x.deletedAt===null));
 }finally{
  if(connected)await client.db(name).dropDatabase();
  await client.close();
 }
});
