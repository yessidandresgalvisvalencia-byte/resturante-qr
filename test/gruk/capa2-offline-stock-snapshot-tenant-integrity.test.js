"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {readOfflineStockSnapshot}=require("../../core/offline/offlineStockSnapshot.service");
const context={empresaId:"507f191e810c19729de860ea",sedeId:"507f1f77bcf86cd799439012",actorId:"operator"};
const productId="507f1f77bcf86cd799439011";
const item={empresaId:context.empresaId,sedeId:context.sedeId,anulado:false,productoServicioId:productId,cantidad:7};
function fake(rows){
 const queries=[];
 return {queries,collection(name){
  assert.equal(name,"inventarios");
  return {find(query,options){
   queries.push({query,options});
   return {async toArray(){return rows;}};
  }};
 }};
}
function run(db,ctx=context){return readOfflineStockSnapshot({db,context:ctx,objectId:x=>x});}
test("Capa 2: stock download checks both tenant query and returned identity",async()=>{
 const db=fake([item]);
 assert.deepEqual(await run(db),{readOnly:true,products:[{productoId:productId,cantidad:"7"}]});
 const [{query,options}]=db.queries;
 assert.equal(query.empresaId,context.empresaId);
 assert.equal(query.sedeId,context.sedeId);
 assert.equal(query.anulado,false);
 for(const field of ["empresaId","sedeId","anulado"])
  assert.equal(options.projection[field],1);
});
test("Capa 2: foreign, deleted or unscoped inventory row never leaks to tablet",async()=>{
 const invalid=[
  {empresaId:"507f191e810c19729de860eb"},
  {sedeId:"507f1f77bcf86cd799439013"},
  {empresaId:undefined},{sedeId:undefined},
  {anulado:true},{anulado:undefined}
 ];
 for(const changes of invalid)
  await assert.rejects(run(fake([{...item,...changes}])),{code:"OFFLINE_STOCK_INVALID_MAPPING"});
});
test("Capa 2: no tenant or operator refuses lookup before database access",async()=>{
 const db={collection(){throw Error("UNSCOPED_STOCK_READ");}};
 for(const ctx of [null,{}, {...context,empresaId:undefined},
  {...context,sedeId:undefined},{...context,actorId:undefined}])
  await assert.rejects(run(db,ctx),{code:"OFFLINE_STOCK_AUTH_REQUIRED"});
});
test("Capa 2: duplicate product stock and invalid quantities are rejected",async()=>{
 for(const rows of [[item,item],[{...item,cantidad:-1}],[{...item,cantidad:1.5}]])
  await assert.rejects(run(fake(rows)),{code:"OFFLINE_STOCK_INVALID_MAPPING"});
});
