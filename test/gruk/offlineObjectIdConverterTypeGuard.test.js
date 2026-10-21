"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {verifyOfflineProducts}=require("../../core/offline/offlineProductsTenant.service");
const {assertOfflineAuthoritativePrices}=require("../../core/offline/offlineAuthoritativePrices.service");
const product="507f1f77bcf86cd799439011",empresa="507f191e810c19729de860ea",sede="507f1f77bcf86cd799439012";
const context={empresaId:empresa,sedeId:sede},session={inTransaction:()=>true};
const prepared={orders:[{items:[{productoId:product}]}]};
const plan={orders:[{items:[{productoId:product,cantidad:"1",precioUnitarioCop:"3000",totalCop:"3000"}]}]};
const genuine=value=>({_bsontype:"ObjectId",toHexString:()=>value,toString:()=>value});
async function authorize(adapter,database){
 await verifyOfflineProducts({collection:database.products,prepared,context,objectId:adapter});
 await assertOfflineAuthoritativePrices({db:database.db,session,context,plan,objectId:adapter});
}
function databases(){
 let count=0;
 const result={products:{find(query){
  count++;assert.equal(query.empresaId.toString(),empresa);
  assert.equal(query.sedeId.toString(),sede);
  return {toArray:async()=>[{_id:product,empresaId:empresa,sedeId:sede,activo:true}]};
 }},db:{collection(name){
  assert.equal(name,"productoservicios");
  return {find(query,opts){
   count++;assert.equal(query.empresaId.toString(),empresa);
   assert.equal(query.sedeId.toString(),sede);
   assert.equal(opts.session,session);
   return {toArray:async()=>[{_id:product,empresaId:empresa,sedeId:sede,activo:true,precioVenta:3000}]};
  }};
 }}};
 return {result,get count(){return count;}};
}
test("Capa 2: adaptadores tipo operador Mongo o toString no llegan a consultas de catálogo ni precios",async()=>{
 for(const converter of [
  value=>({$ne:null,toString:()=>value}),
  value=>({$eq:value,toString:()=>value}),
  value=>({toString:()=>value}),
  value=>({toHexString:()=>value,toString:()=>value}),
  value=>new String(value),
  value=>[value]
 ]){
  let reads=0;
  const collection={find(){reads++;throw Error("UNAUTHORIZED_READ");}};
  const db={collection(){reads++;throw Error("UNAUTHORIZED_READ");}};
  await assert.rejects(verifyOfflineProducts({collection,prepared,context,objectId:converter}),
   {code:"OFFLINE_PRODUCTS_NOT_AUTHORIZED"});
  await assert.rejects(assertOfflineAuthoritativePrices({db,session,context,plan,objectId:converter}),
   {code:"OFFLINE_AUTHORITATIVE_PRICE_CONFLICT"});
  assert.equal(reads,0);
 }
});
test("Capa 2: adaptador BSON ObjectId legítimo mantiene ambas autorizaciones",async()=>{
 const f=databases();
 await authorize(genuine,f.result);
 assert.equal(f.count,2);
});
test("Capa 2: convertidor de cadenas tipadas conserva ambas autorizaciones",async()=>{
 const f=databases();
 await authorize(value=>value,f.result);
 assert.equal(f.count,2);
});
