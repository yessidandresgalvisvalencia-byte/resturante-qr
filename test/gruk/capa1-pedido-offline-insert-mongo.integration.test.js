"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {insertOfflinePedido}=require("../../core/offline/offlinePedidoInsert.service");
test("real Mongo transaction inserts one pending offline pedido after retry",{timeout:120000},async t=>{
 if(!process.env.GRUK_TEST_MONGO_URI){t.skip("Mongo replica set CI only");return;}
 const {MongoClient,ObjectId}=require("mongodb");
 const client=new MongoClient(process.env.GRUK_TEST_MONGO_URI);
 const company=new ObjectId(),menuId=new ObjectId(),productId=new ObjectId();
 const context={empresaId:company.toHexString(),sedeId:"sede1",actorId:"actor1"};
 const event={eventId:"01ARZ3NDEKTSV4RRFFQ69G5FAV",...context,tipo:"PEDIDO_REGISTRADO",payload:{restaurantId:"restaurant1",menuItemId:menuId.toHexString(),mesa:1,cantidad:2,precio:1}};
 try{
  await client.connect();
  const raw=client.db("gruk_offline_pedido_tx");
  await raw.collection("restaurantes").insertOne({restaurantId:"restaurant1",empresaId:context.empresaId});
  await raw.collection("menus").insertOne({_id:menuId,restaurantId:"restaurant1",disponible:true,productoServicioId:productId,precio:5000});
  await raw.collection("productoservicios").insertOne({_id:productId,empresaId:context.empresaId,tipo:"producto",activo:true});
  await raw.collection("pedidos").createIndex({empresaId:1,sedeId:1,offlineEventId:1},{unique:true,partialFilterExpression:{offlineEventId:{$type:"string"}}});
  const db={collection:name=>raw.collection(name),models:{
   Menu:{findOne:query=>({session:session=>raw.collection("menus").findOne(query,{session})})},
   ProductoServicio:{findOne:query=>({session:session=>raw.collection("productoservicios").findOne(query,{session})})}
  }};
  const session=client.startSession();
  try{
   const first=await insertOfflinePedido({event,context,db,session});
   const second=await insertOfflinePedido({event,context,db,session});
   assert.deepEqual(first,{offlineEventId:event.eventId,created:true,paymentPosted:false,inventoryPosted:false});
   assert.equal(second.created,false);
   assert.equal(await raw.collection("pedidos").countDocuments({empresaId:company,sedeId:context.sedeId,offlineEventId:event.eventId}),1);
   const pedido=await raw.collection("pedidos").findOne({offlineEventId:event.eventId});
   assert.equal(pedido.precio,10000);
   assert.equal(pedido.estadoPago,"pendiente");
   assert.equal(await raw.collection("gruk_ledger_movimientos").countDocuments({}),0);
  }finally{await session.endSession();}
 }finally{await client.close();}
});
