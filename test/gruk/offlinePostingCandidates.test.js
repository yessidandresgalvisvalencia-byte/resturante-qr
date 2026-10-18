"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {readOfflineOrderCandidates:read}=require("../../core/offline/offlinePostingCandidates.service");
const ctx={empresaId:"empresaA",sedeId:"sedeA",actorId:"cajeroA"};
const eventId="01ARZ3NDEKTSV4RRFFQ69G5FA0";
const doc={...ctx,eventId,tipo:"PEDIDO_REGISTRADO",status:"PENDIENTE",payload:{
 localOrderId:eventId,items:[{productoId:"prod1",cantidad:"2",precioUnitarioCop:"1500",totalCop:"3000"}],totalCop:"3000"
}};
function fake(records,verify){
 return {collection(name){assert.equal(name,"gruk_offline_inbox");return {find(query){
   verify?.(query);
   return {toArray:async()=>records.filter(x=>x.empresaId===query.empresaId&&x.sedeId===query.sedeId&&x.actorId===query.actorId&&x.tipo===query.tipo&&x.status===query.status&&query.eventId.$in.includes(x.eventId))};
 }};}};
}
test("prepara desde inbox persistente, exige tenant y estado pendiente",async()=>{
 const result=await read({db:fake([doc],q=>{assert.equal(q.empresaId,ctx.empresaId);assert.equal(q.sedeId,ctx.sedeId);assert.equal(q.actorId,ctx.actorId);assert.equal(q.status,"PENDIENTE");}),context:ctx,eventIds:[eventId]});
 assert.equal(result.totalCop,"3000");
});
test("rechaza registros de otro tenant, aplicados o inexistentes",async()=>{
 for(const altered of [{empresaId:"empresaB"},{sedeId:"otra"},{actorId:"otro"},{status:"APLICADO"}]){
   await assert.rejects(read({db:fake([{...doc,...altered}]),context:ctx,eventIds:[eventId]}),e=>e.code==="OFFLINE_ORDERS_NOT_PENDING");
 }
 await assert.rejects(read({db:fake([]),context:ctx,eventIds:[eventId]}),e=>e.code==="OFFLINE_ORDERS_NOT_PENDING");
});
test("rechaza IDs duplicados y comprobantes que no cuadran",async()=>{
 await assert.rejects(read({db:fake([doc]),context:ctx,eventIds:[eventId,eventId]}),e=>e.code==="OFFLINE_INVALID_IDS");
 await assert.rejects(read({db:fake([{...doc,payload:{...doc.payload,totalCop:"2999"}}]),context:ctx,eventIds:[eventId]}),e=>e.code==="OFFLINE_ORDER_NOT_POSTABLE");
});

test("Capa 2: poisoned inbox response cannot bypass tenant, actor, pending status",async()=>{
 const changes=[
  {empresaId:"empresaB"},{sedeId:"sedeB"},{actorId:"otro"},
  {status:"APLICADO"},{status:undefined},
  {tipo:"VENTA"},{eventId:"01ARZ3NDEKTSV4RRFFQ69G5FA1"},
  {empresaId:undefined},{sedeId:undefined},{actorId:undefined}
 ];
 for(const patch of changes){
  const db={collection(name){assert.equal(name,"gruk_offline_inbox");return{
   find(query,options){
    assert.equal(query.status,"PENDIENTE");
    assert.equal(options.projection.status,1);
    return {toArray:async()=>[{...doc,...patch}]};
   }
  };}};
  await assert.rejects(read({db,context:ctx,eventIds:[eventId]}),
   {code:"OFFLINE_ORDERS_NOT_PENDING"});
 }
});
