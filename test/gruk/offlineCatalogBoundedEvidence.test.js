"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {verifyOfflineProducts}=require("../../core/offline/offlineProductsTenant.service");
const {assertOfflineAuthoritativePrices}=require("../../core/offline/offlineAuthoritativePrices.service");
const productId="507f1f77bcf86cd799439011";
const company="507f191e810c19729de860ea",site="507f1f77bcf86cd799439012";
const context={empresaId:company,sedeId:site};
const session={inTransaction:()=>true};
const item={productoId:productId,cantidad:"1",precioUnitarioCop:"3000",totalCop:"3000"};
const prepared={orders:[{items:[item]}]},plan={orders:[{items:[item]}]};
const row={_id:productId,empresaId:company,sedeId:site,activo:true,precioVenta:3000};
const objectId=value=>value;
test("Capa 2: validación de productos consulta solo el alcance y limita exceso de resultados",async()=>{
 let queries=0;
 const collection={find(query,options){
  queries++;
  assert.equal(query.empresaId,company);assert.equal(query.sedeId,site);
  assert.equal(query.activo,true);assert.deepEqual(query._id.$in,[productId]);
  assert.equal(options.limit,2);assert.equal(options.projection.empresaId,1);
  assert.equal(options.session,session);
  return {toArray:async()=>[row]};
 }};
 assert.deepEqual(await verifyOfflineProducts({collection,prepared,context,objectId,session}),[productId]);
 assert.equal(queries,1);
});
test("Capa 2: precios oficiales no aceptan respuestas dispersas ni filas fuera del límite",async()=>{
 for(const results of [new Array(1),[row,row]]){
  let queries=0;
  const db={collection(name){
   assert.equal(name,"productoservicios");
   return {find(query,options){
    queries++;
    assert.equal(query.empresaId,company);assert.equal(query.sedeId,site);
    assert.deepEqual(query._id.$in,[productId]);
    assert.equal(options.session,session);
    assert.equal(options.limit,2);
    return {toArray:async()=>results};
   }};
  }};
  await assert.rejects(assertOfflineAuthoritativePrices({db,session,context,plan,objectId}),
   {code:"OFFLINE_AUTHORITATIVE_PRICE_CONFLICT"});
  assert.equal(queries,1);
 }
});
test("Capa 2: precio COP oficial válido permanece autorizado",async()=>{
 const db={collection:()=>({find(query,options){
  assert.equal(options.limit,2);assert.equal(query.activo,true);
  return {toArray:async()=>[row]};
 }})};
 assert.equal(await assertOfflineAuthoritativePrices({db,session,context,plan,objectId}),true);
});
