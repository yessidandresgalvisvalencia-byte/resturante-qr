"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {readOfflineOrderCandidates}=require("../../core/offline/offlinePostingCandidates.service");

// Real MongoDB integration, isolated from every application database.
// Only runs when the test runner provisions a dedicated MongoDB server.
test("Capa 2 Mongo real: 20 pedidos simultáneos no cruzan empresas sedes ni cajeros",
 {skip:!process.env.GRUK_TEST_MONGO_URI},async()=>{
  const {MongoClient}=require("mongodb");
  const client=new MongoClient(process.env.GRUK_TEST_MONGO_URI,{serverSelectionTimeoutMS:10000});
  const scopes=[
   {empresaId:"empresaA",sedeId:"sede1",actorId:"cajero1"},
   {empresaId:"empresaA",sedeId:"sede2",actorId:"cajero1"},
   {empresaId:"empresaA",sedeId:"sede1",actorId:"cajero2"},
   {empresaId:"empresaB",sedeId:"sede1",actorId:"cajero1"}
  ];
  const dbName="gruk_offline_isolation_"+process.pid+"_"+Date.now();
  let connected=false;
  try{
   await client.connect();
   connected=true;
   const db=client.db(dbName);
   const events=Array.from({length:20},(_,i)=>{
    const eventId="01ARZ3NDEKTSV4RRFFQ69G5FA0".slice(0,24)+String(i).padStart(2,"0");
    return {...scopes[i%4],eventId,tipo:"PEDIDO_REGISTRADO",status:"PENDIENTE",
      payload:{localOrderId:eventId,items:[{productoId:"prod1",cantidad:"1",
       precioUnitarioCop:"1500",totalCop:"1500"}],totalCop:"1500"}};
   });
   await db.collection("gruk_offline_inbox").insertMany(events);
   const results=await Promise.all(events.map(event=>readOfflineOrderCandidates({
     db,context:{empresaId:event.empresaId,sedeId:event.sedeId,actorId:event.actorId},
     eventIds:[event.eventId]
   })));
   for(let i=0;i<events.length;i++){
    assert.equal(results[i].orders.length,1);
    assert.equal(results[i].orders[0].eventId,events[i].eventId);
    assert.equal(results[i].totalCop,"1500");
   }
   let refused=0;
   for(let i=0;i<events.length;i++){
    const event=events[i],foreign=scopes[((i%4)+1)%4];
    await assert.rejects(readOfflineOrderCandidates({
      db,context:foreign,eventIds:[event.eventId]
    }),{code:"OFFLINE_ORDERS_NOT_PENDING"});
    refused++;
   }
   assert.equal(refused,20);
   // One unauthorized event ID invalidates an otherwise valid batch.
   await assert.rejects(readOfflineOrderCandidates({
    db,context:scopes[0],eventIds:[events[0].eventId,events[1].eventId]
   }),{code:"OFFLINE_ORDERS_NOT_PENDING"});
   // Rejected posting must not mutate the durable inbox.
   assert.equal(await db.collection("gruk_offline_inbox").countDocuments({}),20);
   assert.equal(await db.collection("gruk_offline_inbox").countDocuments({status:"PENDIENTE"}),20);
  }finally{
   if(connected){
    await client.db(dbName).dropDatabase();
   }
   await client.close();
  }
 });

test("Capa 2 Mongo real: límite de 100 eventos ordenados y rechazo de lote mixto",
 {skip:!process.env.GRUK_TEST_MONGO_URI},async()=>{
 const {MongoClient}=require("mongodb");
 const client=new MongoClient(process.env.GRUK_TEST_MONGO_URI,{serverSelectionTimeoutMS:10000});
 const name="gruk_offline_batch_"+process.pid+"_"+Date.now();
 let connected=false;
 try{
  await client.connect();
  connected=true;
  const db=client.db(name);
  const scope={empresaId:"empresaA",sedeId:"sede1",actorId:"cajero1"};
  const events=Array.from({length:100},(_,i)=>{
   const eventId="01ARZ3NDEKTSV4RRFFQ69G5FA0".slice(0,24)+String(i).padStart(2,"0");
   return {...scope,eventId,tipo:"PEDIDO_REGISTRADO",status:"PENDIENTE",
    payload:{localOrderId:eventId,items:[{productoId:"productoA",
     cantidad:"3",precioUnitarioCop:"500",totalCop:"1500"}],totalCop:"1500"}};
  });
  // MongoDB does not promise request ordering; financial preflight must restore it.
  await db.collection("gruk_offline_inbox").insertMany([...events].reverse());
  const requestIds=events.map(e=>e.eventId);
  const result=await readOfflineOrderCandidates({db,context:scope,eventIds:requestIds});
  assert.deepEqual(result.orders.map(order=>order.eventId),requestIds);
  assert.equal(result.orders.length,100);
  assert.equal(result.totalCop,"150000");
  // Repeat the read: preflight is read-only and never silently marks an event posted.
  const retry=await readOfflineOrderCandidates({db,context:scope,eventIds:requestIds});
  assert.equal(retry.totalCop,result.totalCop);
  assert.deepEqual(retry.orders,result.orders);
  // insertMany assigns _id to source records; never reuse that Mongo _id.
  const {_id:insertedId,...source}=events[0];
  const foreign={...source,empresaId:"empresaB",eventId:"01ARZ3NDEKTSV4RRFFQ69G5FAZ",
   payload:{...events[0].payload,localOrderId:"01ARZ3NDEKTSV4RRFFQ69G5FAZ"}};
  await db.collection("gruk_offline_inbox").insertOne(foreign);
  await assert.rejects(readOfflineOrderCandidates({
   db,context:scope,eventIds:[requestIds[0],foreign.eventId]
  }),{code:"OFFLINE_ORDERS_NOT_PENDING"});
  let touched=0;
  const forbiddenDb={collection(){touched++;throw Error("OVERSIZE_QUERY");}};
  await assert.rejects(readOfflineOrderCandidates({
   db:forbiddenDb,context:scope,eventIds:[...requestIds,foreign.eventId]
  }),{code:"OFFLINE_INVALID_IDS"});
  assert.equal(touched,0);
  assert.equal(await db.collection("gruk_offline_inbox").countDocuments({}),101);
  assert.equal(await db.collection("gruk_offline_inbox").countDocuments({status:"PENDIENTE"}),101);
 }finally{
  if(connected)await client.db(name).dropDatabase();
  await client.close();
 }
});
