"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { MongoClient, ObjectId } = require("mongodb");

test("Wompi: conflicto de pedido previamente pagado revierte ventas y aprobación del intento",async(t)=>{
 const uri=process.env.TEST_MONGO_URI;
 if(!uri){t.skip("Requiere MongoDB replica set");return;}
 const client=new MongoClient(uri,{serverSelectionTimeoutMS:5000});
 await client.connect();
 const db=client.db("gruk_test_prepaid_conflict_acid");
 const intentos=db.collection("intentos");
 const pedidos=db.collection("pedidos");
 const ventas=db.collection("ventas");
 const intentoId=new ObjectId();
 const primero=new ObjectId(),segundo=new ObjectId();
 const session=client.startSession();
 try{
  await intentos.insertOne({_id:intentoId,estado:"CREADO"});
  await pedidos.insertMany([
   {_id:primero,estadoPago:"pendiente"},
   {_id:segundo,estadoPago:"pagado"}
  ]);
  await assert.rejects(session.withTransaction(async()=>{
   const items=await pedidos.find({_id:{$in:[primero,segundo]}},{session}).toArray();
   for(const pedido of items){
    if(pedido.estadoPago==="pagado")throw new Error("PEDIDO_YA_PAGADO_REQUIERE_CONCILIACION");
    await ventas.insertOne({pedidoId:pedido._id,importeCentavos:5200000},{session});
    await pedidos.updateOne({_id:pedido._id},{$set:{estadoPago:"pagado"}},{session});
   }
   await intentos.updateOne({_id:intentoId},{$set:{estado:"APROBADO"}},{session});
  }),/PEDIDO_YA_PAGADO_REQUIERE_CONCILIACION/);
  assert.equal(await ventas.countDocuments({}),0);
  assert.equal((await intentos.findOne({_id:intentoId})).estado,"CREADO");
  assert.equal((await pedidos.findOne({_id:primero})).estadoPago,"pendiente");
  assert.equal((await pedidos.findOne({_id:segundo})).estadoPago,"pagado");
 }finally{
  await session.endSession();
  await db.dropDatabase();
  await client.close();
 }
});
