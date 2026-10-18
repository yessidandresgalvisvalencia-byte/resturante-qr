"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {verifyOfflineProducts}=require("../../core/offline/offlineProductsTenant.service");
const id="507f1f77bcf86cd799439011";
const empresaId="507f191e810c19729de860ea",sedeId="507f1f77bcf86cd799439012";
const prepared={orders:[{items:[{productoId:id}]}]};
const objectId=x=>x;
function collection(records){
 return {find(query,options){
  assert.equal(query.empresaId,empresaId);
  assert.equal(query.sedeId,sedeId);
  assert.equal(query.activo,true);
  assert.equal(options.projection.empresaId,1);
  assert.equal(options.projection.sedeId,1);
  assert.equal(options.projection.activo,1);
  return {async toArray(){return records;}};
 }};
}
const args={prepared,context:{empresaId,sedeId},objectId};
test("Capa 2: valid owned product survives independent evidence check",async()=>{
 assert.deepEqual(await verifyOfflineProducts({...args,collection:collection([{_id:id,empresaId,sedeId,activo:true}])}),[id]);
});
test("Capa 2: faulty DB/cache cannot pass product of another company or site",async()=>{
 for(const claim of [
  {empresaId:"507f191e810c19729de860eb"},
  {sedeId:"507f1f77bcf86cd799439013"},
  {empresaId:undefined},
  {sedeId:undefined},
  {activo:false},
  {activo:undefined}
 ]){
  await assert.rejects(verifyOfflineProducts({...args,collection:collection([
   {_id:id,empresaId,sedeId,activo:true,...claim}
  ])}),{code:"OFFLINE_PRODUCTS_NOT_AUTHORIZED"});
 }
});
test("Capa 2: duplicate or unrelated product evidence is denied",async()=>{
 const valid={_id:id,empresaId,sedeId,activo:true};
 for(const records of [
  [valid,valid],
  [valid,{...valid,_id:"507f1f77bcf86cd799439013"}]
 ]){
  await assert.rejects(verifyOfflineProducts({...args,collection:collection(records)}),{code:"OFFLINE_PRODUCTS_NOT_AUTHORIZED"});
 }
});
