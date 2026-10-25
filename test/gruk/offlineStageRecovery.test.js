"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {recoverOfflineStagedBatch:recover}=require("../../core/offline/offlineStageRecovery.service");
const ctx={empresaId:"a",sedeId:"b",actorId:"op"};
const ids=["01ARZ3NDEKTSV4RRFFQ69G5FA0","01ARZ3NDEKTSV4RRFFQ69G5FA1"];
function fixture({missing=false,tampered=false,paid=false,duplicate=false}={}){
 let calls=0;
 const scope=ids.map(eventId=>({...ctx,eventId}));
 const rows={
  gruk_offline_inbox:scope.map(s=>({...s,status:"EN_REVISION",financialStageStatus:"PENDIENTE_CONTABILIZACION",inventoryApplied:true,stagedBy:"op"})),
  gruk_offline_ventas:scope.map(s=>({...s,status:"PENDIENTE_CONTABILIZACION",totalCop:"3000"})),
  gruk_offline_caja_intenciones:scope.map(s=>({...s,status:"PENDIENTE_CONCILIACION",cobrado:false,montoCop:"3000"})),
  gruk_ledger_movimientos:scope.map(s=>({...s,tipo:"VENTA_OFFLINE",deletedAt:null,montoCop:"3000"}))
 };
 if(missing)rows.gruk_offline_ventas.pop();
 if(tampered)rows.gruk_offline_inbox[0].inventoryApplied=false;
 if(paid)rows.gruk_offline_caja_intenciones[0].cobrado=true;
 if(duplicate)rows.gruk_offline_ventas.push(rows.gruk_offline_ventas[0]);
 return {client:{startSession:()=>({
  withTransaction:async(fn,options)=>{
   assert.equal(options.readConcern.level,"snapshot");
   await fn();
  },endSession:async()=>{}
 })},collection(name){calls++;return {find(q){
  assert.equal(q.empresaId,"a");assert.equal(q.sedeId,"b");
  if(name==="gruk_offline_inbox")assert.equal(q.actorId,"op");
  assert.deepEqual(q.eventId.$in,ids);
  return {toArray:async()=>rows[name].map(row=>({...row}))};
 }};},get calls(){return calls;}};
}
test("read-only stage recovery recognizes complete staged batch with exact COP sum",async()=>{
 const db=fixture();
 const result=await recover({db,context:ctx,eventIds:ids});
 assert.deepEqual(result,{status:"PENDIENTE_CONTABILIZACION",alreadyStaged:true,
 applied:false,cobrado:false,processedEvents:2,totalCop:"6000"});
 assert.equal(db.calls,7);
});
test("recovery refuses partial, duplicate or tampered financial evidence",async()=>{
 for(const option of [{missing:true},{tampered:true},{paid:true},{duplicate:true}]){
  await assert.rejects(recover({db:fixture(option),context:ctx,eventIds:ids}),
   e=>e.code==="OFFLINE_STAGE_REPLAY_REQUIRES_REVIEW");
 }
});
test("recovery never opens Mongo for invalid ID inputs",async()=>{
 let queries=0;const db={collection(){queries++;throw Error("UNEXPECTED_ACCESS");}};
 await assert.rejects(recover({db,context:ctx,eventIds:[]}),/OFFLINE_STAGE_REPLAY_REQUIRES_REVIEW/);
 assert.equal(queries,0);
});

test("recovery rejects financial rows whose returned tenant, site or actor differs",async()=>{
 for(const name of ["gruk_offline_inbox","gruk_offline_ventas","gruk_offline_caja_intenciones"]){
  for(const key of ["empresaId","sedeId","actorId"]){
   const base=fixture();
   const adapter={client:base.client,collection(collectionName){
    const collection=base.collection(collectionName);
    return {find(query,options){
     const cursor=collection.find(query,options);
     return {async toArray(){
      const result=await cursor.toArray();
      if(collectionName===name)result[0][key]="foreign";
      return result;
     }};
    }};
   }};
   await assert.rejects(recover({db:adapter,context:ctx,eventIds:ids}),
    {code:"OFFLINE_STAGE_REPLAY_REQUIRES_REVIEW"});
  }
 }
});

test("Capa 2: recovery rejects malformed storage collections and unsafe individual COP values",async()=>{
 for(const name of ["gruk_offline_inbox","gruk_offline_ventas","gruk_offline_caja_intenciones"]){
  const base=fixture();
  const db={client:base.client,collection(collectionName){
   const collection=base.collection(collectionName);
   return {find(query,options){
    const original=collection.find(query,options);
    return {toArray:async()=>collectionName===name?null:original.toArray()};
   }};
  }};
  await assert.rejects(recover({db,context:ctx,eventIds:ids}),
   err=>["OFFLINE_STAGE_REPLAY_REQUIRES_REVIEW","OFFLINE_RECONCILIATION_EVIDENCE_INVALID"].includes(err?.code));
 }
 for(const [name,field] of [
  ["gruk_offline_ventas","totalCop"],
  ["gruk_offline_caja_intenciones","montoCop"]
 ]){
  const base=fixture();
  const db={client:base.client,collection(collectionName){
   const collection=base.collection(collectionName);
   return {find(query,options){
    const original=collection.find(query,options);
    return {toArray:async()=>{
     const rows=await original.toArray();
     if(collectionName===name)rows[0][field]="9007199254740992";
     return rows;
    }};
   }};
  }};
  await assert.rejects(recover({db,context:ctx,eventIds:ids}),
   {code:"OFFLINE_STAGE_REPLAY_REQUIRES_REVIEW"});
 }
});

test("Capa 2: recuperación niega getters tenant e IDs antes de consultar Mongo",async()=>{
 for(const field of ["empresaId","sedeId","actorId"]){
  const identity={...ctx};let invoked=0,reads=0;
  Object.defineProperty(identity,field,{enumerable:true,configurable:true,
   get(){invoked++;return ctx[field];}});
  const db={get collection(){reads++;throw Error("UNAUTHORIZED_DB");}};
  await assert.rejects(recover({db,context:identity,eventIds:ids}),
   {code:"OFFLINE_STAGE_REPLAY_REQUIRES_REVIEW"});
  assert.equal(invoked,0);assert.equal(reads,0);
 }
 const eventIds=[ids[0]];let invoked=0,reads=0;
 Object.defineProperty(eventIds,0,{enumerable:true,configurable:true,
  get(){invoked++;return ids[0];}});
 await assert.rejects(recover({db:{get collection(){reads++;throw Error("UNAUTHORIZED_DB");}},
  context:ctx,eventIds}),{code:"OFFLINE_STAGE_REPLAY_REQUIRES_REVIEW"});
 assert.equal(invoked,0);assert.equal(reads,0);
});
test("Capa 2: recuperación fija scope y ULIDs aunque cambie el caller durante reconciliación",async()=>{
 const context={...ctx},eventIds=[...ids],base=fixture();
 let mutated=false;
 const db={client:base.client,collection(name){
  const collection=base.collection(name);
  if(name==="gruk_offline_inbox")return {find(query,opts){
   assert.equal(query.empresaId,ctx.empresaId);
   assert.equal(query.sedeId,ctx.sedeId);
   assert.equal(query.actorId,ctx.actorId);
   assert.deepEqual(query.eventId.$in,ids);
   if(!mutated){
    mutated=true;
    Object.assign(context,{empresaId:"tenantForeign",sedeId:"siteForeign",actorId:"intruso"});
    eventIds[0]="01ARZ3NDEKTSV4RRFFQ69G5FA2";
   }
   return collection.find(query,opts);
  }};
  return collection;
 }};
 const outcome=await recover({db,context,eventIds});
 assert.equal(outcome.totalCop,"6000");
 assert.equal(outcome.processedEvents,2);
 assert.equal(outcome.applied,false);
 assert.equal(outcome.cobrado,false);
});

test("Capa 2: sin sesión Mongo no se consultan diarios ni se confirma replay",async()=>{
 for(const client of [undefined,{}, {startSession:()=>null},
  {startSession:()=>({endSession:async()=>{}})}]){
  let reads=0;
  const db={client,collection(){reads++;throw Error("UNAUTHORIZED_READ");}};
  await assert.rejects(recover({db,context:ctx,eventIds:ids}),
   {code:"OFFLINE_TRANSACTION_UNAVAILABLE"});
  assert.equal(reads,0);
 }
});

test("Capa 2: Mongo standalone rechaza transacciones sin consultar ni alterar diarios",async()=>{
 let reads=0,closed=false;
 const session={
  withTransaction:async()=>{const e=new Error("Transaction numbers are only allowed on a replica set member or mongos");e.code=20;throw e;},
  endSession:async()=>{closed=true;}
 };
 const db={client:{startSession:()=>session},collection(){reads++;throw Error("FORBIDDEN_READ");}};
 await assert.rejects(recover({db,context:ctx,eventIds:ids}),
  {code:"OFFLINE_TRANSACTION_UNAVAILABLE"});
 assert.equal(reads,0);
 assert.equal(closed,true);
});
test("Capa 2: errores Mongo no relacionados no se ocultan como falta de soporte",async()=>{
 let closed=false;
 const original=Object.assign(new Error("Illegal operation unrelated to transactions"),{code:20});
 const db={client:{startSession:()=>({
  withTransaction:async()=>{throw original;},endSession:async()=>{closed=true;}
 })},collection(){throw Error("FORBIDDEN_READ");}};
 await assert.rejects(recover({db,context:ctx,eventIds:ids}),error=>error===original);
 assert.equal(closed,true);
});

test("Capa 2: recuperación comparte snapshot transaccional en los siete diarios",async()=>{
 const base=fixture();
 let active=false,closed=false,queries=0;
 const session={
  withTransaction:async(fn,opts)=>{
   assert.equal(opts.readConcern.level,"snapshot");
   assert.equal(opts.writeConcern.w,"majority");
   active=true;
   try{await fn();}finally{active=false;}
  },
  endSession:async()=>{closed=true;}
 };
 const db={
  client:{startSession:()=>session},
  collection(name){
   const col=base.collection(name);
   return {find(query,opts){
    assert.equal(active,true,"consulta fuera de snapshot "+name);
    assert.equal(opts.session,session,"sesión inconsistente en "+name);
    queries++;
    return col.find(query,opts);
   }};
  }
 };
 const result=await recover({db,context:ctx,eventIds:ids});
 assert.equal(result.totalCop,"6000");
 assert.equal(result.alreadyStaged,true);
 assert.equal(result.applied,false);
 assert.equal(queries,7);
 assert.equal(closed,true);
});
test("Capa 2: excepción de snapshot no confirma recuperación y cierra sesión",async()=>{
 const base=fixture();
 let closed=false,queries=0;
 const session={
  withTransaction:async(fn)=>{
   await fn();
   throw Error("SNAPSHOT_COMMIT_FAILED");
  },
  endSession:async()=>{closed=true;}
 };
 const db={client:{startSession:()=>session},collection(name){
  const col=base.collection(name);
  return {find(q,opts){
   assert.equal(opts.session,session);
   queries++;
   return col.find(q,opts);
  }};
 }};
 await assert.rejects(recover({db,context:ctx,eventIds:ids}),/SNAPSHOT_COMMIT_FAILED/);
 assert.equal(queries,7);
 assert.equal(closed,true);
});
