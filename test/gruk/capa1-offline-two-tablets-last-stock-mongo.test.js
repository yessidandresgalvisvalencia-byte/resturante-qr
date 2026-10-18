"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {randomUUID}=require("node:crypto");
const {acceptOfflineBatch,ensureInboxIndexes}=require("../../core/offline/offlineInbox.service");

const uri=process.env.GRUK_TEST_MONGO_URI||process.env.TEST_MONGO_URI;
test("MongoDB real: dos tablets venden último producto; segunda queda en revisión sin doble débito",{
 skip:!uri&&"Requiere MongoDB replica set aislado",timeout:45000
},async()=>{
 const {mongo}=require("mongoose");
 const {stageAuthorizedOfflineOrders}=require("../../core/offline/offlineAdminStage.service");
 const client=new mongo.MongoClient(uri,{serverSelectionTimeoutMS:10000});
 const name="gruk_oversell_tablets_"+randomUUID().replace(/-/g,"");
 const company=new mongo.ObjectId(),site=new mongo.ObjectId(),product=new mongo.ObjectId();
 const context={empresaId:company.toHexString(),sedeId:site.toHexString(),actorId:"operador-uno"};
 const auth={...context,usuarioId:context.actorId,rol:"ADMIN_SEDE"};
 const eventIds=["01ARZ3NDEKTSV4RRFFQ69G5FA0","01ARZ3NDEKTSV4RRFFQ69G5FA2"];
 const events=eventIds.map((eventId,i)=>({
  ...context,eventId,deviceId:i===0?"tablet-a":"tablet-b",
  tipo:"PEDIDO_REGISTRADO",occurredAt:"2026-10-18T12:00:00.000Z",schemaVersion:1,
  payload:{localOrderId:i===0?"01ARZ3NDEKTSV4RRFFQ69G5FA1":"01ARZ3NDEKTSV4RRFFQ69G5FA3",
   items:[{productoId:product.toHexString(),cantidad:"1",precioUnitarioCop:"5000",totalCop:"5000"}],
   totalCop:"5000"}
 }));
 let connected=false;
 try{
  await client.connect();connected=true;
  const db=client.db(name);
  const scoped={client,collection:collection=>db.collection(collection)};
  await ensureInboxIndexes(db);
  for(const [collection,name,keys] of [
   ["gruk_offline_ventas","uniq_offline_sale_tenant_event",{empresaId:1,sedeId:1,eventId:1}],
   ["gruk_offline_caja_intenciones","uniq_offline_cash_tenant_event",{empresaId:1,sedeId:1,eventId:1}],
   ["gruk_offline_stock_movimientos","uniq_offline_stock_tenant_batch_product",{empresaId:1,sedeId:1,batchId:1,productoId:1}],
   ["gruk_ledger_movimientos","uniq_offline_ledger_event_type_tenant",{empresaId:1,sedeId:1,eventId:1,tipo:1}]
  ])await db.collection(collection).createIndex(keys,{name,unique:true});
  await db.collection("productoservicios").insertOne({
   _id:product,empresaId:company,sedeId:site,activo:true,precioVenta:5000
  });
  const legacyKey={empresaId:company,sedeId:site,productoServicioId:product,anulado:false};
  await db.collection("inventarios").insertOne({...legacyKey,cantidad:1});
  const receive=await acceptOfflineBatch({db:scoped,authenticatedContext:context,events});
  assert.deepEqual(receive.map(x=>x.status),["RECIBIDO","RECIBIDO"]);
  assert.equal(await db.collection("gruk_offline_inbox").countDocuments({
   empresaId:context.empresaId,sedeId:context.sedeId,status:"PENDIENTE"
  }),2);
  const stage=ids=>stageAuthorizedOfflineOrders({
   db:scoped,auth,eventIds:ids,confirmed:true
  });
  const first=await stage([eventIds[0]]);
  assert.equal(first.status,"PENDIENTE_CONTABILIZACION");
  assert.equal(first.applied,false);
  assert.equal(first.cobrado,false);
  assert.equal((await db.collection("inventarios").findOne(legacyKey)).cantidad,0);
  const second=await stage([eventIds[1]]);
  assert.equal(second.status,"REQUIERE_REVISION_STOCK");
  assert.equal(second.applied,false);
  assert.equal(second.cobrado,false);
  assert.equal(second.issues.length,1);
  assert.equal(second.issues[0].disponible,"0");
  assert.equal(second.issues[0].solicitado,"1");
  assert.equal(second.issues[0].faltante,"1");
  assert.equal((await db.collection("inventarios").findOne(legacyKey)).cantidad,0);
  const keySecond={empresaId:context.empresaId,sedeId:context.sedeId,eventId:eventIds[1]};
  const inboxSecond=await db.collection("gruk_offline_inbox").findOne(keySecond);
  assert.equal(inboxSecond.status,"PENDIENTE");
  assert.equal(inboxSecond.inventoryApplied,undefined);
  for(const journal of ["gruk_offline_ventas","gruk_offline_caja_intenciones","gruk_ledger_movimientos"])
   assert.equal(await db.collection(journal).countDocuments(keySecond),0,journal);
  assert.equal(await db.collection("gruk_offline_stock_movimientos").countDocuments({
   empresaId:context.empresaId,sedeId:context.sedeId
  }),1);
  const again=await stage([eventIds[1]]);
  assert.equal(again.conflictId,second.conflictId);
  assert.deepEqual(again.issues,second.issues);
  assert.equal(await db.collection("gruk_offline_stock_conflicts").countDocuments({
   empresaId:context.empresaId,sedeId:context.sedeId,actorId:context.actorId
  }),1);
  assert.equal((await db.collection("inventarios").findOne(legacyKey)).cantidad,0);
  assert.equal(await db.collection("gruk_offline_ventas").countDocuments({
   empresaId:context.empresaId,sedeId:context.sedeId
  }),1);
  assert.equal((await db.collection("gruk_offline_caja_intenciones").findOne({
   empresaId:context.empresaId,sedeId:context.sedeId,eventId:eventIds[0]
  })).cobrado,false);
 }finally{
  if(connected){try{await client.db(name).dropDatabase();}finally{await client.close();}}
  else await client.close();
 }
});
