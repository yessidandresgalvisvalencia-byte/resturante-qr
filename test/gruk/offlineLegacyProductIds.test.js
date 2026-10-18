"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {validateOfflineLegacyProductIds:check}=require("../../core/offline/offlineLegacyProductIds.contract");
const prepared={orders:[{items:[{productoId:"507f1f77bcf86cd799439011"},{productoId:"507F1F77BCF86CD799439011"},{productoId:"507f191e810c19729de860ea"}]}]};
test("preflight legado: solo IDs Mongo reales, únicos y normalizados",()=>{
 assert.deepEqual(check(prepared),["507f1f77bcf86cd799439011","507f191e810c19729de860ea"]);
});
test("preflight legado: rechaza SKU, ULID, texto y objetos",()=>{
 for(const value of ["prod_1","01ARZ3NDEKTSV4RRFFQ69G5FA0","507f1f77bcf86cd79943901z",{},null]){
   assert.throws(()=>check({orders:[{items:[{productoId:value}]}]}),
     e=>e.code==="OFFLINE_PRODUCT_ID_UNMAPPED");
 }
});
test("preflight legado: nunca admite lotes vacíos",()=>{
 assert.throws(()=>check({orders:[]}),e=>e.code==="OFFLINE_PRODUCT_ID_UNMAPPED");
});
