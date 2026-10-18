"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {executeOfflineStagingTransaction:execute}=require("../../core/offline/offlineStagingTransaction.service");
const eventId="01ARZ3NDEKTSV4RRFFQ69G5FA0",productId="507f1f77bcf86cd799439011";
const context={empresaId:"507f191e810c19729de860ea",sedeId:"507f1f77bcf86cd799439012",actorId:"cajero"};
const inbox={...context,eventId,tipo:"PEDIDO_REGISTRADO",status:"PENDIENTE",payload:{localOrderId:eventId,items:[{productoId:productId,cantidad:"1",precioUnitarioCop:"3000",totalCop:"3000"}],totalCop:"3000"}};
const indices={
 gruk_offline_ventas:["uniq_offline_sale_tenant_event",{empresaId:1,sedeId:1,eventId:1}],
 gruk_offline_stock_movimientos:["uniq_offline_stock_tenant_batch_product",{empresaId:1,sedeId:1,batchId:1,productoId:1}],
 gruk_offline_caja_intenciones:["uniq_offline_cash_tenant_event",{empresaId:1,sedeId:1,eventId:1}],
 gruk_ledger_movimientos:["uniq_offline_ledger_event_type_tenant",{empresaId:1,sedeId:1,eventId:1,tipo:1}]
};
function fixture(failOn,missingIndex){
 const committed=[],session={active:false,inTransaction(){return this.active;},
 async withTransaction(fn){this.active=true;const pending=[];this.pending=pending;try{await fn();committed.push(...pending);}finally{this.active=false;}},
 async endSession(){this.ended=true;}};
 let started=0;
 const db={client:{startSession:()=>{started++;return session;}},collection(name){
  if(name==="gruk_offline_inbox")return {find:(_q,opts)=>{assert.equal(opts.session,session);return {toArray:async()=>[inbox]};}};
  if(name==="productoservicios")return {find:(_q,opts)=>{assert.equal(opts.session,session);return {toArray:async()=>[{_id:productId,empresaId:context.empresaId,sedeId:context.sedeId,activo:true}]};}};
  const index=indices[name];assert.ok(index,"unexpected collection "+name);
  return {indexes:async()=>name===missingIndex?[]:[{name:index[0],key:index[1],unique:true}],
   updateOne:async(_key,update,opts)=>{assert.equal(opts.session,session);assert.equal(session.active,true);
    if(name===failOn)throw Error("SIMULATED_WRITE_FAILURE");
    session.pending.push({name,document:update.$setOnInsert});return {upsertedCount:1};}};
 }};
 return {db,session,committed,started:()=>started};
}
test("four staging writes commit together when callback succeeds",async()=>{
 const f=fixture();const result=await execute({db:f.db,context,eventIds:[eventId],objectId:x=>x});
 assert.equal(result.sales.totalCop,"3000");assert.equal(result.cash.totalCop,"3000");
 assert.equal(result.ledger.totalCop,"3000");assert.equal(f.committed.length,4);
 assert.equal(f.session.ended,true);
});
test("simulation of transaction abort leaves no committed staging rows",async()=>{
 const f=fixture("gruk_ledger_movimientos");
 await assert.rejects(execute({db:f.db,context,eventIds:[eventId],objectId:x=>x}),/SIMULATED_WRITE_FAILURE/);
 assert.equal(f.committed.length,0);assert.equal(f.session.ended,true);
});
test("missing unique cash index blocks staging before opening session",async()=>{
 const f=fixture(null,"gruk_offline_caja_intenciones");
 await assert.rejects(execute({db:f.db,context,eventIds:[eventId],objectId:x=>x}),e=>e.code==="OFFLINE_INDEX_NOT_READY");
 assert.equal(f.started(),0);assert.equal(f.committed.length,0);
});
