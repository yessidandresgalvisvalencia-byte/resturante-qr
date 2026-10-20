"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {stageOfflineSales:stage}=require("../../core/offline/offlineSalesStaging.service");
const eventId="01ARZ3NDEKTSV4RRFFQ69G5FA0";
const context={empresaId:"empresa",sedeId:"sede",actorId:"cajero"};
const plan={orders:[{eventId,localOrderId:eventId,totalCop:"3000",items:[{productoId:"507f1f77bcf86cd799439011",cantidad:"1",precioUnitarioCop:"3000",totalCop:"3000"}]}],totalCop:"3000"};
function fixture(indexReady=true){
 const data=new Map();const session={inTransaction:()=>true};
 const db={collection:name=>{
  assert.equal(name,"gruk_offline_ventas");
  return {indexes:async()=>indexReady?[{name:"uniq_offline_sale_tenant_event",unique:true,key:{empresaId:1,sedeId:1,eventId:1}}]:[],
  updateOne:async(key,update,opts)=>{assert.equal(opts.session,session);if(data.has(key.eventId))return {upsertedCount:0};
   data.set(key.eventId,update.$setOnInsert);return {upsertedCount:1};},
  findOne:async key=>data.get(key.eventId)};
 }};
 return {db,session,data};
}
test("escribe venta pendiente una vez y reintento idéntico no duplica",async()=>{
 const f=fixture();const first=await stage({...f,context,plan});const retry=await stage({...f,context,plan});
 assert.equal(first.records[0].inserted,true);assert.equal(retry.records[0].inserted,false);
 assert.equal(f.data.size,1);assert.equal(f.data.get(eventId).totalCop,"3000");
});
test("falla cerrado si falta índice único y no inserta",async()=>{
 const f=fixture(false);
 await assert.rejects(stage({...f,context,plan}),e=>e.code==="OFFLINE_SALES_UNIQUE_INDEX_REQUIRED");
 assert.equal(f.data.size,0);
});
test("detecta reintento con importe incompatible",async()=>{
 const f=fixture();await stage({...f,context,plan});
 const changed={...plan,orders:[{...plan.orders[0],totalCop:"3001"}],totalCop:"3001"};
 await assert.rejects(stage({...f,context,plan:changed}),e=>e.code==="OFFLINE_SALES_REPLAY_CONFLICT");
});
test("rechaza importe agregado incorrecto antes de escribir",async()=>{
 const f=fixture();
 await assert.rejects(stage({...f,context,plan:{...plan,totalCop:"2999"}}),e=>e.code==="OFFLINE_SALES_TOTAL_CONFLICT");
 assert.equal(f.data.size,0);
});

test("Capa 2: replay of a persisted sale from another tenant or event is rejected",async()=>{
 for(const patch of [
  {empresaId:"otra"},{sedeId:"otra"},{eventId:"01ARZ3NDEKTSV4RRFFQ69G5FA1"},
  {empresaId:undefined},{sedeId:undefined},{eventId:undefined}
 ]){
  const session={inTransaction:()=>true};
  let writes=0;
  const db={collection(name){assert.equal(name,"gruk_offline_ventas");return {
   async indexes(){return [{name:"uniq_offline_sale_tenant_event",unique:true,key:{empresaId:1,sedeId:1,eventId:1}}];},
   async updateOne(key){writes++;assert.equal(key.empresaId,context.empresaId);assert.equal(key.sedeId,context.sedeId);return {upsertedCount:0};},
   async findOne(key,options){
    assert.equal(options.session,session);
    assert.equal(options.projection.empresaId,1);
    assert.equal(options.projection.sedeId,1);
    assert.equal(options.projection.eventId,1);
    return {...context,eventId,localOrderId:eventId,totalCop:"3000",items:plan.orders[0].items,
      status:"PENDIENTE_CONTABILIZACION",...patch};
   }
  };}};
  await assert.rejects(stage({db,session,context,plan}),{code:"OFFLINE_SALES_REPLAY_CONFLICT"});
  assert.equal(writes,1);
 }
});

test("Capa 2: sales rejects huge COP and sparse orders before Mongo",async()=>{
 const badOrders=[
  [{...plan.orders[0],totalCop:"9".repeat(10000)}],
  [{...plan.orders[0],totalCop:"9007199254740992"}],
  new Array(1),
  [plan.orders[0],,plan.orders[0]]
 ];
 for(const orders of badOrders){
  let accesses=0;
  const db={collection(){accesses++;throw Error("UNEXPECTED_DB_ACCESS");}};
  await assert.rejects(stage({db,session:{inTransaction:()=>true},context,
   plan:{...plan,orders,totalCop:orders[0]?.totalCop||plan.totalCop}}),
   {code:"OFFLINE_SALES_INVALID_PLAN"});
  assert.equal(accesses,0);
 }
});

test("Capa 2: acuses de ventas nulos o malformados no se aceptan como reintento",async()=>{
 for(const ack of [null,undefined,{}, {upsertedCount:null},
  {upsertedCount:2},{upsertedCount:-1},{upsertedCount:"1"}]){
  let lookups=0;
  const session={inTransaction:()=>true};
  const db={collection:()=>({
   indexes:async()=>[{name:"uniq_offline_sale_tenant_event",
     unique:true,key:{empresaId:1,sedeId:1,eventId:1}}],
   updateOne:async()=>ack,
   findOne:async()=>{lookups++;throw Error("UNAUTHORIZED_REPLAY_READ");}
  })};
  await assert.rejects(stage({db,session,context,plan}),
   {code:"OFFLINE_SALES_WRITE_UNVERIFIED"});
  assert.equal(lookups,0);
 }
});

test("Capa 2: metadatos de índices nulos o malformados bloquean ventas antes de escritura",async()=>{
 for(const metadata of [null,undefined,{}, {indexes:[]}, false, "invalid"]){
  let writes=0;
  const session={inTransaction:()=>true};
  const db={collection(name){
   assert.equal(name,"gruk_offline_ventas");
   return {
    indexes:async()=>metadata,
    updateOne:async()=>{writes++;throw Error("UNEXPECTED_SALE_WRITE");}
   };
  }};
  await assert.rejects(stage({db,session,context,plan}),
   {code:"OFFLINE_SALES_UNIQUE_INDEX_REQUIRED"});
  assert.equal(writes,0);
 }
});

test("Capa 2: índice ausente o entradas corruptas no provocan escritura",async()=>{
 for(const indexMetadata of [undefined,null,[null],[undefined],[false],[{name:"irrelevant"},null]]){
  let writes=0;
  const db={collection:()=>({
   ...(indexMetadata===undefined?{}:{indexes:async()=>indexMetadata}),
   updateOne:async()=>{writes++;throw Error("UNEXPECTED_FINANCIAL_WRITE");}
  })};
  await assert.rejects(stage({db,session:{inTransaction:()=>true},context,plan}),{code:"OFFLINE_SALES_UNIQUE_INDEX_REQUIRED"});
  assert.equal(writes,0);
 }
});

test("Capa 2: ventas offline sin líneas válidas se rechazan antes de consultar Mongo",async()=>{
 const badItems=[undefined,null,{},[],[null],[false],[[]],new Array(1),[plan.orders[0].items[0],,plan.orders[0].items[0]]];
 for(const items of badItems){
  let collectionCalls=0;
  const db={collection(){collectionCalls++;throw Error("UNEXPECTED_SALE_DB_ACCESS");}};
  const invalid={...plan,orders:[{...plan.orders[0],items}]};
  await assert.rejects(stage({db,session:{inTransaction:()=>true},context,plan:invalid}),
   {code:"OFFLINE_SALES_INVALID_PLAN"});
  assert.equal(collectionCalls,0);
 }
});

test("Capa 2: producto y cantidad inválidos no alcanzan MongoDB",async()=>{
 const base=plan.orders[0],item=base.items[0];
 const bad=[
  [{...item,productoId:{$ne:null}}],
  [{...item,productoId:"$admin"}],
  [{...item,productoId:undefined}],
  [{...item,cantidad:"0"}],
  [{...item,cantidad:"1.5"}],
  [{...item,cantidad:1}],
  [{...item,cantidad:"9007199254740992"}]
 ];
 for(const items of bad){
  let calls=0;
  const db={collection(){calls++;throw Error("UNEXPECTED_DB_ACCESS");}};
  await assert.rejects(stage({db,session:{inTransaction:()=>true},context,
   plan:{...plan,orders:[{...base,items} ]}}),{code:"OFFLINE_SALES_INVALID_PLAN"});
  assert.equal(calls,0);
 }
});
test("Capa 2: contrato antiguo sin precios por línea sigue aceptado",async()=>{
 const f=fixture(),base=plan.orders[0],item=base.items[0];
 const order={...base,items:[{productoId:item.productoId,cantidad:"2"}]};
 const result=await stage({...f,context,plan:{...plan,orders:[order]}});
 assert.equal(result.totalCop,"3000");
 assert.equal(f.data.size,1);
});
test("Capa 2: no se prohíben descuentos legítimos por usar neto diferente al bruto",async()=>{
 const f=fixture(),base=plan.orders[0],item=base.items[0];
 const discount={...plan,orders:[{...base,totalCop:"2700",items:[
  {...item,cantidad:"1",precioUnitarioCop:"3000",totalCop:"3000"}]}],totalCop:"2700"};
 const result=await stage({...f,context,plan:discount});
 assert.equal(result.totalCop,"2700");
});

test("Capa 2: rechazo de escritura no reconocida sin lectura de replay",async()=>{
 for(const upsertedCount of [0,1]){
  let replayReads=0;
  const db={collection:()=>({
   indexes:async()=>[{name:"uniq_offline_sale_tenant_event",unique:true,key:{empresaId:1,sedeId:1,eventId:1}}],
   updateOne:async()=>({acknowledged:false,upsertedCount}),
   findOne:async()=>{replayReads++;throw Error("UNCONFIRMED_REPLAY_READ");}
  })};
  await assert.rejects(stage({db,session:{inTransaction:()=>true},context,plan}),{code:"OFFLINE_SALES_WRITE_UNVERIFIED"});
  assert.equal(replayReads,0);
 }
});
