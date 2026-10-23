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

test("Capa 2: event ID arrays with holes are rejected before inbox access",async()=>{
 const other="01ARZ3NDEKTSV4RRFFQ69G5FA1";
 for(const eventIds of [
  new Array(1),[eventId,,],[,eventId],[eventId,,other]
 ]){
  let queries=0;
  const db={collection(){queries++;throw Error("UNAUTHORIZED_INBOX_READ");}};
  await assert.rejects(read({db,context:ctx,eventIds}),
   {code:"OFFLINE_INVALID_IDS"});
  assert.equal(queries,0);
 }
});

test("Capa 2: financial preflight cannot skip sparse events or omit their amount",()=>{
 const {prepareOfflineOrders,prepareOfflineOrdersForTenant}=
  require("../../core/offline/offlineOrdersBatch.preflight");
 const second={...doc,eventId:"01ARZ3NDEKTSV4RRFFQ69G5FA1",
  payload:{...doc.payload,localOrderId:"01ARZ3NDEKTSV4RRFFQ69G5FA1"}};
 for(const events of [new Array(1),[doc,,second],[,doc],[doc,,]]){
  assert.throws(()=>prepareOfflineOrders(events),
   {code:"OFFLINE_ORDER_BATCH_CONFLICT"});
  assert.throws(()=>prepareOfflineOrdersForTenant(events,ctx),
   {code:"OFFLINE_ORDER_BATCH_CONFLICT"});
 }
 const valid=prepareOfflineOrdersForTenant([doc,second],ctx);
 assert.equal(valid.totalCop,"6000");
 assert.equal(valid.orders.length,2);
});

test("Capa 2: pedido rechaza artículos dispersos y COP enormes antes del cálculo",()=>{
 const {validateOfflineOrderForPosting:validate}=
  require("../../core/offline/offlineOrderPosting.contract");
 const base=doc;
 const good=base.payload.items[0];
 const broken=[
  {...base,payload:{...base.payload,items:new Array(1)}},
  {...base,payload:{...base.payload,items:[good,,good]}},
  {...base,payload:{...base.payload,items:[good,,]}},
  {...base,payload:{...base.payload,totalCop:"9".repeat(10000)}},
  {...base,payload:{...base.payload,items:[{...good,cantidad:"9".repeat(10000)}]}},
  {...base,payload:{...base.payload,items:[{...good,precioUnitarioCop:"9".repeat(10000)}]}},
  {...base,payload:{...base.payload,items:[{...good,totalCop:"9".repeat(10000)}]}}
 ];
 for(const invalid of broken){
  assert.throws(()=>validate(invalid),{code:"OFFLINE_ORDER_NOT_POSTABLE"});
 }
 const expected=validate(base);
 assert.equal(expected.totalCop,"3000");
 assert.equal(expected.items.length,1);
});

test("Capa 2: consultas de candidatos siempre acotadas al lote y su empresa",async()=>{
 const other="01ARZ3NDEKTSV4RRFFQ69G5FA1";
 let reads=0;
 const db={collection(name){
  assert.equal(name,"gruk_offline_inbox");reads++;
  return {find(query,options){
   assert.deepEqual(query,{empresaId:ctx.empresaId,sedeId:ctx.sedeId,
    actorId:ctx.actorId,tipo:"PEDIDO_REGISTRADO",status:"PENDIENTE",
    eventId:{$in:[eventId,other]}});
   assert.equal(options.limit,3);
   assert.equal(options.projection.empresaId,1);
   assert.equal(options.projection.sedeId,1);
   assert.equal(options.projection.actorId,1);
   return {toArray:async()=>[]};
  }};
 }};
 await assert.rejects(read({db,context:ctx,eventIds:[eventId,other]}),
  {code:"OFFLINE_ORDERS_NOT_PENDING"});
 assert.equal(reads,1);
});
test("Capa 2: eventos con permisos heredados del prototipo no se pueden contabilizar",async()=>{
 for(const missing of ["empresaId","sedeId","actorId","tipo","status","eventId","payload"]){
  const record=Object.assign(Object.create({[missing]:doc[missing]}),doc);
  delete record[missing];
  let queries=0;
  const db={collection(){queries++;return {find(){return {toArray:async()=>[record]};}};}};
  await assert.rejects(read({db,context:ctx,eventIds:[eventId]}),
   {code:"OFFLINE_ORDERS_NOT_PENDING"});
  assert.equal(queries,1);
 }
});
test("Capa 2: respuesta inbox mayor que la solicitada se rechaza sin preflight financiero",async()=>{
 const tooMany=[doc,{...doc}];
 let requests=0;
 const db={collection(){requests++;return {find(query,options){
  assert.equal(options.limit,2);
  return {toArray:async()=>tooMany};
 }};}};
 await assert.rejects(read({db,context:ctx,eventIds:[eventId]}),
  {code:"OFFLINE_ORDERS_NOT_PENDING"});
 assert.equal(requests,1);
});

test("Capa 2: identidad de cajero heredada del prototipo nunca consulta inbox",async()=>{
 for(const key of ["empresaId","sedeId","actorId"]){
  const inherited=Object.assign(Object.create({[key]:ctx[key]}),ctx);
  delete inherited[key];
  assert.equal(inherited[key],ctx[key]);
  assert.equal(Object.hasOwn(inherited,key),false);
  let reads=0;
  const db={collection(){reads++;throw Error("CROSS_TENANT_INBOX_READ");}};
  await assert.rejects(read({db,context:inherited,eventIds:[eventId]}),
   {code:"OFFLINE_AUTH_REQUIRED"});
  assert.equal(reads,0);
 }
});
test("Capa 2: identidad propia válida mantiene búsqueda delimitada y recibo exacto",async()=>{
 let queries=0;
 const db=fake([doc],query=>{
  queries++;
  assert.equal(query.empresaId,ctx.empresaId);
  assert.equal(query.sedeId,ctx.sedeId);
  assert.equal(query.actorId,ctx.actorId);
 });
 const result=await read({db,context:{...ctx},eventIds:[eventId]});
 assert.equal(queries,1);
 assert.equal(result.totalCop,"3000");
});

test("Capa 2: identidades dinamicas con getters se rechazan antes de leer Mongo",async()=>{
 for(const field of ["empresaId","sedeId","actorId"]){
  let accesses=0,queries=0;
  const context={...ctx};
  Object.defineProperty(context,field,{enumerable:true,configurable:true,
   get(){accesses++;return accesses===1?ctx[field]:"empresaB";}});
  const db={collection(){queries++;throw Error("CROSS_TENANT_READ");}};
  await assert.rejects(read({db,context,eventIds:[eventId]}),
   {code:"OFFLINE_AUTH_REQUIRED"});
  assert.equal(accesses,0);
  assert.equal(queries,0);
 }
});
test("Capa 2: identidad valida se fija aunque el objeto original cambie durante consulta",async()=>{
 const context={...ctx};
 let reads=0;
 const db={collection(){return {find(query){
  assert.equal(query.empresaId,"empresaA");
  assert.equal(query.sedeId,"sedeA");
  assert.equal(query.actorId,"cajeroA");
  Object.assign(context,{empresaId:"empresaB",sedeId:"sedeB",actorId:"otro"});
  reads++;
  return {toArray:async()=>[doc]};
 }};}};
 const result=await read({db,context,eventIds:[eventId]});
 assert.equal(reads,1);
 assert.equal(result.totalCop,"3000");
});
