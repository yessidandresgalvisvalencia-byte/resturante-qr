"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {readOfflineStockSnapshot:read}=require("../../core/offline/offlineStockSnapshot.service");
const local=require("../../public/js/gruk-offline-stock.js");
const product="507f1f77bcf86cd799439011";
const context={empresaId:"507f191e810c19729de860ea",sedeId:"507f1f77bcf86cd799439012",actorId:"employee"};
const objectId=id=>id;
function inventory(rows){return {collection(name){assert.equal(name,"inventarios");return {find(q,options){
 assert.equal(q.empresaId,context.empresaId);assert.equal(q.sedeId,context.sedeId);
 assert.equal(q.anulado,false);assert.equal(options.limit,501);
 return {toArray:async()=>rows.map(row=>({empresaId:context.empresaId,sedeId:context.sedeId,anulado:false,...row}))};
 }};}};}
test("stock server: strict tenant+site, only safe quantities, no money writes",async()=>{
 const result=await read({db:inventory([{productoServicioId:product,cantidad:1}]),context,objectId});
 assert.deepEqual(result,{readOnly:true,products:[{productoId:product,cantidad:"1"}]});
});
test("stock server: missing identity and duplicated/fractional stock fail closed",async()=>{
 for(const ctx of [{...context,sedeId:null},{...context,empresaId:"$ne"},{...context,actorId:"$or"}])
 await assert.rejects(read({db:inventory([]),context:ctx,objectId}),/OFFLINE_STOCK_AUTH_REQUIRED/);
 for(const rows of [[{productoServicioId:product,cantidad:2.5}],
  [{productoServicioId:product,cantidad:-1}],
  [{productoServicioId:product,cantidad:1},{productoServicioId:product,cantidad:2}],
  [{productoServicioId:product,cantidad:Number.MAX_SAFE_INTEGER+1}]])
 await assert.rejects(read({db:inventory(rows),context,objectId}),/OFFLINE_STOCK_INVALID_MAPPING/);
});
test("stock local: two tablets independently estimate last unit with conflict to resolve on server",()=>{
 const confirmed=[{productoId:product,cantidad:"1"}];
 const eventId="01ARZ3NDEKTSV4RRFFQ69G5FA0";
 const reservation=[{eventId,productoId:product,cantidad:"1"}];
 const a=local.estimate(confirmed,reservation);
 const b=local.estimate(confirmed,reservation);
 assert.equal(a[0].estimated,"0");
 assert.equal(b[0].estimated,"0");
 assert.equal(local.estimate(confirmed,[...reservation,{eventId:"01ARZ3NDEKTSV4RRFFQ69G5FA1",productoId:product,cantidad:"1"}])[0].warning,"LOCAL_OVERSOLD");
 assert.equal(local.estimate([],reservation)[0].warning,"NO_SERVER_STOCK_MAPPING");
});
test("stock local: exact BigInt calculations and tenant isolation",()=>{
 const id="01ARZ3NDEKTSV4RRFFQ69G5FA0";
 const result=local.estimate([{productoId:product,cantidad:"9007199254740991"}],
  [{eventId:id,productoId:product,cantidad:"9007199254740990"}]);
 assert.equal(result[0].estimated,"1");
 assert.notEqual(local.scopeKey(context),local.scopeKey({...context,actorId:"another"}));
 assert.throws(()=>local.estimate([{productoId:product,cantidad:"1.5"}],[]),/LOCAL_STOCK_INVALID_SNAPSHOT/);
 assert.throws(()=>local.estimate([], [{eventId:id,productoId:product,cantidad:"1.2"}]),/LOCAL_STOCK_INVALID_RESERVATIONS/);
});
