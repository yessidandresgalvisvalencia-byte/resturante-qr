"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {readOfflineCatalog}=require("../../core/offline/offlineCatalog.service");
const client=require("../../public/js/gruk-offline-catalog");
const ctx={empresaId:"507f191e810c19729de860ea",sedeId:"507f1f77bcf86cd799439012",actorId:"operator"};
const productId="507f1f77bcf86cd799439011";
function db(rows){let reads=0;return {collection(name){assert.equal(name,"productoservicios");return {find(q,options){
 reads++;assert.equal(String(q.empresaId),ctx.empresaId);assert.equal(String(q.sedeId),ctx.sedeId);
 assert.equal(q.tipo,"producto");assert.equal(q.activo,true);
 assert.equal(options.limit,501);
 assert.deepEqual(options.projection,{_id:1,nombre:1,precioVenta:1});
 return {toArray:async()=>rows};
 }};},get reads(){return reads;}};}
test("offline catalog: only same-company/site active products with integer COP price",async()=>{
 const source=db([{_id:productId,nombre:"Empanada",precioVenta:3000}]);
 const result=await readOfflineCatalog({db:source,context:ctx,objectId:x=>x});
 assert.deepEqual(result,{products:[{productoId:productId,nombre:"Empanada",precioUnitarioCop:"3000"}],readOnly:true});
 assert.equal(source.reads,1);
});
test("offline catalog: invalid identity must fail before DB query",async()=>{
 let calls=0;const source={collection(){calls++;throw Error("QUERY_BLOCKED");}};
 for(const bad of [{...ctx,empresaId:"$ne"},{...ctx,sedeId:undefined},{...ctx,actorId:"admin.$ne"}])
  await assert.rejects(readOfflineCatalog({db:source,context:bad,objectId:x=>x}),/OFFLINE_CATALOG_AUTH_REQUIRED/);
 assert.equal(calls,0);
});
test("offline catalog: missing, fractional, oversized or duplicate rows fail closed",async()=>{
 for(const rows of [
 [{_id:productId,nombre:"Empanada",precioVenta:3.5}],
 [{_id:productId,nombre:"Empanada"}],
 [{_id:productId,nombre:"Empanada",precioVenta:-1}],
 [{_id:productId,nombre:"",precioVenta:3000}],
 Array.from({length:501},()=>({_id:productId,nombre:"Duplicado",precioVenta:100})),
 [{_id:productId,nombre:"Uno",precioVenta:3000},{_id:productId,nombre:"Dos",precioVenta:3000}]
 ])await assert.rejects(readOfflineCatalog({db:db(rows),context:ctx,objectId:x=>x}),/OFFLINE_CATALOG_/);
});
test("local catalog: isolate by operator; reject tampered prices before writing IndexedDB",()=>{
 assert.notEqual(client.keyFor(ctx),client.keyFor({...ctx,actorId:"other"}));
 assert.notEqual(client.keyFor(ctx),client.keyFor({...ctx,sedeId:"507f1f77bcf86cd799439013"}));
 const good=[{productoId:productId,nombre:"Empanada",precioUnitarioCop:"3000"}];
 assert.deepEqual(client.validateProducts(good),good);
 for(const invalid of [
 [{...good[0],precioUnitarioCop:"3.50"}],
 [{...good[0],precioUnitarioCop:"9007199254740992"}],
 [{...good[0],productoId:"$ne"}],
 [good[0],good[0]]
 ])assert.throws(()=>client.validateProducts(invalid),/OFFLINE_CATALOG_INVALID_SNAPSHOT/);
});
