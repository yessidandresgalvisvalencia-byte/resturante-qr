"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {executeOfflineInventoryStagingTransaction:execute}=require("../../core/offline/offlineInventoryStagingTransaction.service");
test("no inicia sesión ni modifica inventario si faltan índices únicos",async()=>{
 let started=0,inventoryAccess=0;
 const db={client:{startSession(){started++;throw Error("should not start");}},
  collection(){inventoryAccess++;return {indexes:async()=>[]};}};
 await assert.rejects(execute({db,context:{empresaId:"tenant",sedeId:"site"},eventIds:[],
  objectId:x=>x}),()=>true);
 assert.equal(started,0);assert.ok(inventoryAccess>=1);
});
test("rechaza una base de datos no disponible antes de cualquier operación",async()=>{
 await assert.rejects(execute({db:null,context:{},eventIds:[],objectId:x=>x}),()=>true);
});
