"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {verifyOfflineProducts:verify}=require("../../core/offline/offlineProductsTenant.service");
const product="507f1f77bcf86cd799439011",empresa="507f191e810c19729de860ea",sede="507f1f77bcf86cd799439012";
const prepared={orders:[{items:[{productoId:product}]}]},context={empresaId:empresa,sedeId:sede};
const objectId=x=>x;
function collection(records,inspect){return {find(q){inspect?.(q);return {toArray:async()=>records};}};}
test("producto offline: exige match por empresa, sede y activo",async()=>{
 const ids=await verify({collection:collection([{_id:product}],q=>{
 assert.equal(q.empresaId,empresa);assert.equal(q.sedeId,sede);assert.equal(q.activo,true);
 assert.deepEqual(q._id.$in,[product]);
 }),prepared,context,objectId});
 assert.deepEqual(ids,[product]);
});
test("producto offline: falla cerrado si producto no existe en tenant",async()=>{
 await assert.rejects(verify({collection:collection([]),prepared,context,objectId}),e=>e.code==="OFFLINE_PRODUCTS_NOT_AUTHORIZED");
 await assert.rejects(verify({collection:collection([{_id:"507f1f77bcf86cd799439013"}]),prepared,context,objectId}),e=>e.code==="OFFLINE_PRODUCTS_NOT_AUTHORIZED");
});
test("producto offline: niega contexto sin empresa o sede Mongo válida",async()=>{
 await assert.rejects(verify({collection:collection([]),prepared,context:{empresaId:"empresa",sedeId:sede},objectId}),e=>e.code==="OFFLINE_PRODUCTS_NOT_AUTHORIZED");
});
