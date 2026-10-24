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

test("Capa 2: preflight financiero rechaza identidad autenticada con getters",()=>{
 const {prepareOfflineOrdersForTenant:prepare}=
  require("../../core/offline/offlineOrdersBatch.preflight");
 for(const field of ["empresaId","sedeId","actorId"]){
  let reads=0;
  const dynamic={...ctx};
  Object.defineProperty(dynamic,field,{enumerable:true,configurable:true,
   get(){reads++;return reads===1?ctx[field]:"empresaB";}});
  assert.throws(()=>prepare([doc],dynamic),{code:"OFFLINE_ORDER_BATCH_CONFLICT"});
  assert.equal(reads,0);
 }
});
test("Capa 2: preflight financiero conserva identidad propia y COP exactos",()=>{
 const {prepareOfflineOrdersForTenant:prepare}=
  require("../../core/offline/offlineOrdersBatch.preflight");
 const identity=Object.assign(Object.create({empresaId:"empresaB"}),ctx);
 const result=prepare([doc],identity);
 assert.equal(result.orders.length,1);
 assert.equal(result.totalCop,"3000");
});

test("Capa 2: eventos offline con getters tenant nunca pasan preflight",()=>{
 const {prepareOfflineOrdersForTenant:prepare}=
  require("../../core/offline/offlineOrdersBatch.preflight");
 for(const field of ["empresaId","sedeId","actorId"]){
  let reads=0;
  const poisoned={...doc};
  Object.defineProperty(poisoned,field,{enumerable:true,configurable:true,
   get(){reads++;return reads===1?ctx[field]:"empresaB";}});
  assert.throws(()=>prepare([poisoned],ctx),{code:"OFFLINE_ORDER_BATCH_CONFLICT"});
  assert.equal(reads,0);
 }
 const valid=prepare([{...doc}],ctx);
 assert.equal(valid.totalCop,"3000");
});

test("Capa 2: getters en importes y datos financieros no se ejecutan",()=>{
 const {validateOfflineOrderForPosting:validate}=
  require("../../core/offline/offlineOrderPosting.contract");
 const cases=[
  [()=>({...doc}),"tipo"],
  [()=>({...doc}),"eventId"],
  [()=>({...doc}),"payload"],
  [()=>({...doc,payload:{...doc.payload}}),"payload.totalCop"],
  [()=>({...doc,payload:{...doc.payload}}),"payload.localOrderId"],
  [()=>({...doc,payload:{...doc.payload}}),"payload.items"],
  [()=>({...doc,payload:{...doc.payload,items:[{...doc.payload.items[0]}]}}),"payload.items.0.cantidad"],
  [()=>({...doc,payload:{...doc.payload,items:[{...doc.payload.items[0]}]}}),"payload.items.0.precioUnitarioCop"],
  [()=>({...doc,payload:{...doc.payload,items:[{...doc.payload.items[0]}]}}),"payload.items.0.totalCop"],
  [()=>({...doc,payload:{...doc.payload,items:[{...doc.payload.items[0]}]}}),"payload.items.0.productoId"]
 ];
 for(const [factory,path] of cases){
  const order=factory();
  const parts=path.split(".");
  let owner=order;
  for(const part of parts.slice(0,-1))owner=owner[part];
  const key=parts.at(-1);
  let invoked=0;
  Object.defineProperty(owner,key,{enumerable:true,configurable:true,
   get(){invoked++;return "3000";}});
  assert.throws(()=>validate(order),{code:"OFFLINE_ORDER_NOT_POSTABLE"});
  assert.equal(invoked,0,path);
 }
 assert.equal(validate(doc).totalCop,"3000");
});

test("Capa 2: respuesta de Mongo con accessors tenant es rechazada sin ejecutarlos",async()=>{
 for(const field of ["eventId","empresaId","sedeId","actorId","tipo","status","payload"]){
  let invoked=0;
  const poisoned={...doc};
  Object.defineProperty(poisoned,field,{enumerable:true,configurable:true,
   get(){invoked++;return field==="empresaId"?"empresaB":doc[field];}});
  const db={collection(name){assert.equal(name,"gruk_offline_inbox");return{
   find(){return {toArray:async()=>[poisoned]};}
  };}};
  await assert.rejects(read({db,context:ctx,eventIds:[eventId]}),
   {code:"OFFLINE_ORDERS_NOT_PENDING"});
  assert.equal(invoked,0,field);
 }
});
test("Capa 2: resultados inbox válidos mantienen identidad y COP exactos",async()=>{
 const result=await read({db:fake([doc]),context:{...ctx},eventIds:[eventId]});
 assert.equal(result.orders.length,1);
 assert.equal(result.totalCop,"3000");
});

test("Capa 2: IDs de eventos con getters se rechazan antes de Mongo",async()=>{
 let invoked=0,queried=0;
 const ids=[eventId];
 Object.defineProperty(ids,0,{configurable:true,enumerable:true,
   get(){invoked++;return invoked===1?eventId:"01ARZ3NDEKTSV4RRFFQ69G5FA1";}});
 const db={collection(){queried++;throw Error("UNAUTHORIZED_READ");}};
 await assert.rejects(read({db,context:ctx,eventIds:ids}),{code:"OFFLINE_INVALID_IDS"});
 assert.equal(invoked,0);
 assert.equal(queried,0);
});
test("Capa 2: resultados Mongo con getters en índice son rechazados",async()=>{
 let invoked=0;
 const results=[doc];
 Object.defineProperty(results,0,{configurable:true,enumerable:true,
   get(){invoked++;return doc;}});
 const db={collection(){return {find(){return {toArray:async()=>results};}};}};
 await assert.rejects(read({db,context:ctx,eventIds:[eventId]}),
   {code:"OFFLINE_ORDERS_NOT_PENDING"});
 assert.equal(invoked,0);
});
test("Capa 2: cambio de ID durante consulta no cambia el lote validado",async()=>{
 const ids=[eventId];
 const db={collection(){return {find(query){
  assert.deepEqual(query.eventId.$in,[eventId]);
  ids[0]="01ARZ3NDEKTSV4RRFFQ69G5FA1";
  return {toArray:async()=>[doc]};
 }};}};
 const result=await read({db,context:ctx,eventIds:ids});
 assert.equal(result.totalCop,"3000");
 assert.equal(result.orders[0].eventId,eventId);
});

test("Capa 2: getters en posiciones de items son rechazados sin ejecución",()=>{
 const {validateOfflineOrderForPosting:validate}=
  require("../../core/offline/offlineOrderPosting.contract");
 let hits=0;
 const items=[{...doc.payload.items[0]}];
 Object.defineProperty(items,0,{configurable:true,enumerable:true,
  get(){hits++;return doc.payload.items[0];}});
 assert.throws(()=>validate({...doc,payload:{...doc.payload,items}}),
  {code:"OFFLINE_ORDER_NOT_POSTABLE"});
 assert.equal(hits,0);
});
test("Capa 2: getters en posiciones del lote no se ejecutan",()=>{
 const {prepareOfflineOrders,prepareOfflineOrdersForTenant}=
  require("../../core/offline/offlineOrdersBatch.preflight");
 const events=[doc];
 let hits=0;
 Object.defineProperty(events,0,{configurable:true,enumerable:true,
  get(){hits++;return doc;}});
 assert.throws(()=>prepareOfflineOrders(events),{code:"OFFLINE_ORDER_BATCH_CONFLICT"});
 assert.throws(()=>prepareOfflineOrdersForTenant(events,ctx),{code:"OFFLINE_ORDER_BATCH_CONFLICT"});
 assert.equal(hits,0);
});
test("Capa 2: el preflight valida snapshot ante mutación de lote",()=>{
 const {prepareOfflineOrdersForTenant:prepare}=
  require("../../core/offline/offlineOrdersBatch.preflight");
 const events=[doc];
 const original=doc;
 const first={...doc};
 Object.defineProperty(first,"empresaId",{enumerable:true,configurable:true,
  get(){ events[0]={...original,empresaId:"empresaB"};return "empresaA";}});
 events[0]=first;
 assert.throws(()=>prepare(events,ctx),{code:"OFFLINE_ORDER_BATCH_CONFLICT"});
 assert.equal(events[0],first);
});

test("Capa 2: bloquea colisiones cruzadas de ULID entre evento y pedido",()=>{
 const {prepareOfflineOrders,prepareOfflineOrdersForTenant}=
  require("../../core/offline/offlineOrdersBatch.preflight");
 const firstId="01ARZ3NDEKTSV4RRFFQ69G5FA0";
 const secondId="01ARZ3NDEKTSV4RRFFQ69G5FA1";
 const thirdId="01ARZ3NDEKTSV4RRFFQ69G5FA2";
 const fourthId="01ARZ3NDEKTSV4RRFFQ69G5FA3";
 const first={...doc,eventId:firstId,payload:{...doc.payload,localOrderId:secondId}};
 const swapped={...doc,eventId:secondId,payload:{...doc.payload,localOrderId:firstId}};
 const collision={...doc,eventId:thirdId,payload:{...doc.payload,localOrderId:firstId}};
 for(const list of [[first,swapped],[first,collision]]){
  assert.throws(()=>prepareOfflineOrders(list),{code:"OFFLINE_ORDER_BATCH_CONFLICT"});
  assert.throws(()=>prepareOfflineOrdersForTenant(list,ctx),{code:"OFFLINE_ORDER_BATCH_CONFLICT"});
 }
 const valid={...doc,eventId:thirdId,payload:{...doc.payload,localOrderId:fourthId}};
 const result=prepareOfflineOrdersForTenant([first,valid],ctx);
 assert.equal(result.totalCop,"6000");
 assert.equal(result.orders.length,2);
});
