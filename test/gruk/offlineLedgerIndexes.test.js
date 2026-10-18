"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {ensureOfflineLedgerIndexes:ensure}=require("../../core/offline/offlineLedgerIndexes.service");
test("crea indice unico por tenant, evento y tipo sin indexar actor",async()=>{
 let called=0;
 const db={collection(name){assert.equal(name,"gruk_ledger_movimientos");return {createIndex:async(keys,options)=>{
  called++;assert.deepEqual(keys,{empresaId:1,sedeId:1,eventId:1,tipo:1});
  assert.equal(options.unique,true);assert.equal(options.name,"uniq_offline_ledger_event_type_tenant");
  return options.name;}};}};
 assert.equal(await ensure(db),true);assert.equal(called,1);
});
test("no omite errores de creación del índice",async()=>{
 const db={collection:()=>({createIndex:async()=>{throw new Error("E11000 duplicate key");}})};
 await assert.rejects(ensure(db),/E11000/);
});
test("rechaza inicialización sin base de datos",async()=>{
 await assert.rejects(ensure(null),/OFFLINE_DATABASE_REQUIRED/);
});
