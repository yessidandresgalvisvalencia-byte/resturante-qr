"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {prepareOfflineOrdersInTransaction:prepare}=require("../../core/offline/offlineTransactionalPreflight.service");
const id="01ARZ3NDEKTSV4RRFFQ69G5FA0",product="507f1f77bcf86cd799439011";
const context={empresaId:"507f191e810c19729de860ea",sedeId:"507f1f77bcf86cd799439012",actorId:"cajero"};
const event={...context,eventId:id,tipo:"PEDIDO_REGISTRADO",payload:{localOrderId:id,items:[{productoId:product,cantidad:"1",precioUnitarioCop:"3000",totalCop:"3000"}],totalCop:"3000"}};
test("usa snapshot y misma sesión en ambas colecciones, y la libera",async()=>{
 let closed=false,options,seen=[];
 const session={withTransaction:async(fn,opts)=>{options=opts;await fn();},endSession:async()=>{closed=true;}};
 const db={client:{startSession:()=>session},collection:name=>({find:(query,opts)=>{seen.push(opts.session);return {toArray:async()=>name==="gruk_offline_inbox"?[event]:[{_id:product,empresaId:context.empresaId,sedeId:context.sedeId,activo:true}]};}})};
 const result=await prepare({db,context,eventIds:[id],objectId:x=>x});
 assert.equal(result.totalCop,"3000");
 assert.deepEqual(seen,[session,session]);assert.equal(options.readConcern.level,"snapshot");assert.equal(closed,true);
});
test("rechaza si faltan transacciones sin consultar el inbox",async()=>{
 await assert.rejects(prepare({db:{collection:()=>{throw Error("UNEXPECTED");}},context,eventIds:[id],objectId:x=>x}),e=>e.code==="OFFLINE_TRANSACTION_UNAVAILABLE");
});
test("libera sesión cuando falla la verificación de productos",async()=>{
 let closed=false;
 const session={withTransaction:async fn=>fn(),endSession:async()=>{closed=true;}};
 const db={client:{startSession:()=>session},collection:name=>({find:()=>({toArray:async()=>name==="gruk_offline_inbox"?[event]:[]})})};
 await assert.rejects(prepare({db,context,eventIds:[id],objectId:x=>x}),e=>e.code==="OFFLINE_PRODUCTS_NOT_AUTHORIZED");
 assert.equal(closed,true);
});
