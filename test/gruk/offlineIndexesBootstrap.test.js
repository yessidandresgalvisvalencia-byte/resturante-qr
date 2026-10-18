"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {bootstrapOfflineStagingIndexes:bootstrap}=require("../../core/offline/offlineIndexesBootstrap.service");
const collections=new Map();
const specs={
 gruk_offline_ventas:"uniq_offline_sale_tenant_event",
 gruk_offline_stock_movimientos:"uniq_offline_stock_tenant_batch_product",
 gruk_offline_caja_intenciones:"uniq_offline_cash_tenant_event",
 gruk_ledger_movimientos:"uniq_offline_ledger_event_type_tenant"
};
function fakeDb(failOn){
 return {collection(name){if(!specs[name])throw Error("UNEXPECTED_COLLECTION");
  return {async createIndex(key,options){if(name===failOn)throw Error("INDEX_COLLISION");
   assert.equal(options.unique,true);collections.set(name,{name:options.name,key,unique:true});return options.name;},
   async indexes(){return collections.has(name)?[collections.get(name)]:[]}};
 }};
}
test("crea y comprueba los cuatro indices del staging",async()=>{
 collections.clear();const result=await bootstrap(fakeDb());
 assert.deepEqual(result,{ready:true,collections:4});
 assert.equal(collections.size,4);
});
test("un indice rechazado por Mongo interrumpe migración",async()=>{
 collections.clear();
 await assert.rejects(bootstrap(fakeDb("gruk_offline_caja_intenciones")) ,/INDEX_COLLISION/);
 assert.equal(collections.has("gruk_ledger_movimientos"),false);
});
test("sin conexion de DB no ejecuta migracion",async()=>{
 await assert.rejects(bootstrap({}),/OFFLINE_DATABASE_REQUIRED/);
});
