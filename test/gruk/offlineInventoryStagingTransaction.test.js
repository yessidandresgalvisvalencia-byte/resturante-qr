"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {executeOfflineInventoryStagingTransaction:execute}=require("../../core/offline/offlineInventoryStagingTransaction.service");
test("no inicia sesión ni modifica inventario si faltan índices únicos",async()=>{
 let started=0,inventoryAccess=0;
 const db={client:{startSession(){started++;throw Error("should not start");}},
  collection(){inventoryAccess++;return {indexes:async()=>[]};}};
 await assert.rejects(execute({db,context:{empresaId:"507f191e810c19729de860ea",sedeId:"507f1f77bcf86cd799439012",actorId:"cajero"},eventIds:["01ARZ3NDEKTSV4RRFFQ69G5FA0"],
  objectId:x=>x}),()=>true);
 assert.equal(started,0);assert.ok(inventoryAccess>=1);
});
test("rechaza una base de datos no disponible antes de cualquier operación",async()=>{
 await assert.rejects(execute({db:null,context:{},eventIds:[],objectId:x=>x}),()=>true);
});

test("Capa 2: unscoped and forged inventory staging requests never read any collection",async()=>{
 let calls=0,sessions=0;
 const db={collection(){calls++;throw Error("UNAUTHORIZED_INDEX_READ");},
  client:{startSession(){sessions++;throw Error("UNAUTHORIZED_SESSION");}}};
 const valid={empresaId:"507f191e810c19729de860ea",
  sedeId:"507f1f77bcf86cd799439012",actorId:"cajero"};
 const eventId="01ARZ3NDEKTSV4RRFFQ69G5FA0";
 const checks=[
  {context:null,eventIds:[eventId]},
  {context:{...valid,empresaId:undefined},eventIds:[eventId]},
  {context:{...valid,sedeId:undefined},eventIds:[eventId]},
  {context:{...valid,actorId:undefined},eventIds:[eventId]},
  {context:{...valid,empresaId:"$ne"},eventIds:[eventId]},
  {context:{...valid,sedeId:"other-tenant"},eventIds:[eventId]},
  {context:valid,eventIds:[]},
  {context:valid,eventIds:[eventId,eventId]},
  {context:valid,eventIds:["invalid"]},
  {context:valid,eventIds:[eventId],objectId:null}
 ];
 for(const args of checks){
  await assert.rejects(execute({db,context:args.context,eventIds:args.eventIds,
   objectId:args.objectId===undefined?(value=>value):args.objectId}),
   {code:"OFFLINE_INVENTORY_TENANT_REQUIRED"});
 }
 assert.equal(calls,0);
 assert.equal(sessions,0);
});
