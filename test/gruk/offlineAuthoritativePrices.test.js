"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {assertOfflineAuthoritativePrices:verify}=require("../../core/offline/offlineAuthoritativePrices.service");
const productId="507f1f77bcf86cd799439011";
const ctx={empresaId:"507f191e810c19729de860ea",sedeId:"507f1f77bcf86cd799439012"};
const session={inTransaction:()=>true};
const objectId=id=>id;
function plan(price="3000"){return {orders:[{items:[{productoId:productId,cantidad:"2",precioUnitarioCop:price,totalCop:"6000"}]}]};}
function db(...args){const price=args.length?args[0]:3000;let called=false;return {collection(name){assert.equal(name,"productoservicios");return {find(q,options){called=true;assert.equal(options.session,session);assert.equal(q.empresaId,ctx.empresaId);assert.equal(q.sedeId,ctx.sedeId);assert.equal(q.activo,true);return {toArray:async()=>[{_id:productId,precioVenta:price}]};}};},get called(){return called;}};}
async function check(database,order=plan()){return verify({db:database,session,context:ctx,plan:order,objectId});}
test("offline pricing: accepts integer COP catalog price within same Mongo transaction",async()=>{
 const database=db();assert.equal(await check(database),true);assert.equal(database.called,true);
});
test("offline pricing: rejects tampered client price with no financial writes",async()=>{
 await assert.rejects(check(db(5000)),e=>e.code==="OFFLINE_AUTHORITATIVE_PRICE_CONFLICT");
 await assert.rejects(check(db(),plan("2999")),/OFFLINE_AUTHORITATIVE_PRICE_CONFLICT/);
});
test("offline pricing: missing, fractional or unsafe legacy prices fail closed",async()=>{
 for(const value of [undefined,null,3000.50,NaN,-1,Number.MAX_SAFE_INTEGER+1]){
  await assert.rejects(check(db(value)),/OFFLINE_AUTHORITATIVE_PRICE_CONFLICT/);
 }
});
test("offline pricing: incomplete product list, wrong tenant or absent transaction fails",async()=>{
 const database={collection:()=>({find:()=>({toArray:async()=>[]})})};
 await assert.rejects(check(database),/OFFLINE_AUTHORITATIVE_PRICE_CONFLICT/);
 await assert.rejects(verify({db:db(),session:{inTransaction:()=>false},context:ctx,plan:plan(),objectId}),
  /OFFLINE_AUTHORITATIVE_PRICE_CONFLICT/);
 await assert.rejects(verify({db:db(),session,context:{...ctx,sedeId:"otro"},plan:plan(),objectId}),
  /OFFLINE_AUTHORITATIVE_PRICE_CONFLICT/);
});
