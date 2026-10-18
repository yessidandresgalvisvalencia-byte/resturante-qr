"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {executeOfflinePostingTransaction:execute}=require("../../core/offline/offlinePostingTransaction.service");
const id="01ARZ3NDEKTSV4RRFFQ69G5FA0",product="507f1f77bcf86cd799439011";
const context={empresaId:"507f191e810c19729de860ea",sedeId:"507f1f77bcf86cd799439012",actorId:"cajero"};
const event={...context,eventId:id,tipo:"PEDIDO_REGISTRADO",payload:{localOrderId:id,items:[{productoId:product,cantidad:"1",precioUnitarioCop:"3000",totalCop:"3000"}],totalCop:"3000"}};
function createDb(){
 let closed=false,committed=false;
 const session={withTransaction:async(fn,opts)=>{assert.equal(opts.readConcern.level,"snapshot");await fn();committed=true;},endSession:async()=>{closed=true;}};
 const db={client:{startSession:()=>session},collection:name=>({find:(q,opts)=>{assert.equal(opts.session,session);return {toArray:async()=>name==="gruk_offline_inbox"?[event]:[{_id:product}]};}})};
 return {db,session,state:()=>({closed,committed})};
}
test("posteo por callback recibe plan y sesión dentro de misma transacción",async()=>{
 const fixture=createDb();let called=false;
 const result=await execute({db:fixture.db,context,eventIds:[id],objectId:x=>x,
 postDomainOperations:async({plan,session})=>{called=true;assert.equal(session,fixture.session);assert.equal(plan.totalCop,"3000");return "POSTED";}});
 assert.equal(result,"POSTED");assert.equal(called,true);assert.deepEqual(fixture.state(),{closed:true,committed:true});
});
test("sin aplicador explícito rechaza operación antes de iniciar sesión",async()=>{
 await assert.rejects(execute({db:{},context,eventIds:[id],objectId:x=>x}),e=>e.code==="OFFLINE_POSTER_REQUIRED");
});
test("fallo de posteo interrumpe transacción y libera sesión",async()=>{
 const fixture=createDb();
 await assert.rejects(execute({db:fixture.db,context,eventIds:[id],objectId:x=>x,
 postDomainOperations:async()=>{throw Error("DOMAIN_POSTING_FAILED");}}),/DOMAIN_POSTING_FAILED/);
 assert.deepEqual(fixture.state(),{closed:true,committed:false});
});
