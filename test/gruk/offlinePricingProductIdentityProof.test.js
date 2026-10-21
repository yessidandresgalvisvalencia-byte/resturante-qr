"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {assertOfflineAuthoritativePrices}=require("../../core/offline/offlineAuthoritativePrices.service");
const productId="507f1f77bcf86cd799439011";
const context={empresaId:"507f191e810c19729de860ea",sedeId:"507f1f77bcf86cd799439012"};
const session={inTransaction:()=>true};
const plan={orders:[{items:[{productoId,cantidad:"1",precioUnitarioCop:"3000",totalCop:"3000"}]}]};
const base={empresaId:context.empresaId,sedeId:context.sedeId,activo:true,precioVenta:3000};
function fixture(id){
 let read=0;
 return {get read(){return read;},db:{collection(name){
  assert.equal(name,"productoservicios");
  return {find(query,opts){read++;
   assert.equal(query.empresaId,context.empresaId);assert.equal(query.sedeId,context.sedeId);
   assert.equal(opts.session,session);assert.equal(opts.limit,2);
   return {toArray:async()=>[{...base,_id:id}]};}
  };
 }}};
}
test("Capa 2: precios oficiales nunca aceptan ID de producto fabricado con toString",async()=>{
 for(const id of [null,undefined,{},[],123,{toString:()=>productId},
   {toHexString:productId,toString:()=>productId}]){
  const f=fixture(id);
  await assert.rejects(assertOfflineAuthoritativePrices({db:f.db,session,context,plan,objectId:x=>x}),
   {code:"OFFLINE_AUTHORITATIVE_PRICE_CONFLICT"});
  assert.equal(f.read,1);
 }
});
test("Capa 2: se conservan IDs ObjectId de BSON y strings válidos",async()=>{
 for(const id of [productId,{toHexString:()=>productId,toString:()=>productId}]){
  const f=fixture(id);
  assert.equal(await assertOfflineAuthoritativePrices({
   db:f.db,session,context,plan,objectId:x=>x}),true);
  assert.equal(f.read,1);
 }
});
