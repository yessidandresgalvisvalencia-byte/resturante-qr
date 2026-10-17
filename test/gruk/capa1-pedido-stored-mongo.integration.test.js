"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
test("stored offline order processing: one persisted order and correct retry",{timeout:120000},async t=>{
 if(!process.env.GRUK_TEST_MONGO_URI){t.skip("Mongo replica set required");return;}
 const {MongoClient,ObjectId}=require("mongodb");
 const {acceptOfflineBatch,ensureInboxIndexes}=require("../../core/offline/offlineInbox.service");
 const {processStoredOfflinePedido}=require("../../core/offline/offlinePedidoStoredProcessor.service");
 const client=new MongoClient(process.env.GRUK_TEST_MONGO_URI);
 const company=new ObjectId(),menuId=new ObjectId(),productId=new ObjectId();
 const context={empresaId:company.toHexString(),sedeId:"S1",actorId:"U1"};
 const event={eventId:"01ARZ3NDEKTSV4RRFFQ69G5FAV",...context,deviceId:"tablet1",
  tipo:"PEDIDO_REGISTRADO",occurredAt:"2026-10-17T20:00:00.000Z",schemaVersion:1,
  payload:{restaurantId:"r1",menuItemId:menuId.toHexString(),mesa:1,cantidad:2}};
 try{
  await client.connect();const raw=client.db("offline_stored_order_test");
  await raw.collection("restaurantes").insertOne({restaurantId:"r1",empresaId:context.empresaId});
  await raw.collection("menus").insertOne({_id:menuId,restaurantId:"r1",disponible:true,productoServicioId:productId,precio:5000});
  await raw.collection("productoservicios").insertOne({_id:productId,empresaId:context.empresaId,tipo:"producto",activo:true});
  await ensureInboxIndexes(raw);
  await raw.collection("pedidos").createIndex({empresaId:1,sedeId:1,offlineEventId:1},{unique:true,partialFilterExpression:{offlineEventId:{$type:"string"}}});
  const db={collection:n=>raw.collection(n),models:{
   Menu:{findOne:q=>({session:s=>raw.collection("menus").findOne({...q,_id:new ObjectId(q._id)},{session:s})})},
   ProductoServicio:{findOne:q=>({session:s=>raw.collection("productoservicios").findOne(q,{session:s})})}
  }};
  await acceptOfflineBatch({db:raw,authenticatedContext:context,events:[event]});
  try{
   await raw.collection("menus").updateOne({_id:menuId},{$set:{precio:1.5}});
   await assert.rejects(processStoredOfflinePedido({db,client,context,eventId:event.eventId}),/OFFLINE_PRICE_NOT_INTEGER_COP/);
   assert.equal((await raw.collection("gruk_offline_inbox").findOne({eventId:event.eventId})).status,"PENDIENTE");
   assert.equal(await raw.collection("pedidos").countDocuments({}),0);
   await raw.collection("menus").updateOne({_id:menuId},{$set:{precio:5000}});
   const first=await processStoredOfflinePedido({db,client,context,eventId:event.eventId});
   await assert.rejects(processStoredOfflinePedido({db,client,context:{...context,actorId:"intruder"},eventId:event.eventId}),/OFFLINE_EVENT_NOT_FOUND/);
   const again=await processStoredOfflinePedido({db,client,context,eventId:event.eventId});
   assert.equal(first.created,true);assert.equal(first.status,"EN_REVISION");
   assert.equal(again.created,false);assert.equal(again.status,"EN_REVISION");
   assert.equal(await raw.collection("pedidos").countDocuments({offlineEventId:event.eventId}),1);
   const pedido=await raw.collection("pedidos").findOne({offlineEventId:event.eventId});
   assert.equal(pedido.precio,10000);assert.equal(pedido.estadoPago,"pendiente");
   assert.equal(await raw.collection("gruk_ledger_movimientos").countDocuments({}),0);
  }finally{}
 }finally{await client.close();}
});
