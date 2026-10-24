"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { stageOfflineFinancialBatch } = require("../../core/offline/offlineFinancialStaging.service");
const { assertFreshOfflineStaging } = require("../../core/offline/offlineInventoryStagingTransaction.service");
const { calculateOfflineStockDeltas } = require("../../core/offline/offlineInventoryDeltas.service");
const { buildOfflineLedgerPlan } = require("../../core/offline/offlineLedgerPlan.service");

const { applyOfflineLegacyInventory } = require("../../core/offline/offlineLegacyInventoryWriter.service");

const uri = process.env.GRUK_TEST_MONGO_URI || process.env.TEST_MONGO_URI;

test("MongoDB real: caída tras 4 diarios y stock revierte toda la transacción", {
  skip: !uri && "Requiere MongoDB de pruebas con replica set",
  timeout: 45000
}, async () => {
  const { mongo } = require("mongoose");
  const client = new mongo.MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  const name = "gruk_fin_atomic_" + randomUUID().replace(/-/g, "");
  const empresa = new mongo.ObjectId();
  const sede = new mongo.ObjectId();
  const producto = new mongo.ObjectId();
  const empresaId = empresa.toHexString();
  const sedeId = sede.toHexString();
  const productoId = producto.toHexString();
  const context = { empresaId, sedeId, actorId: "operador-uno" };
  const eventId = "01ARZ3NDEKTSV4RRFFQ69G5FA0";
  const plan = { orders: [{
    eventId, localOrderId: "01ARZ3NDEKTSV4RRFFQ69G5FA1",
    totalCop: "7500", items: [{ productoId, cantidad: "2" }]
  }], totalCop: "7500" };
  const deltas = [{ productoId, deltaUnidades: "-2" }];
  let connected = false;
  try {
    await client.connect();
    connected = true;
    const db = client.db(name);
    await db.collection("gruk_offline_ventas").createIndex(
      { empresaId: 1, sedeId: 1, eventId: 1 },
      { unique: true, name: "uniq_offline_sale_tenant_event" });
    await db.collection("gruk_offline_caja_intenciones").createIndex(
      { empresaId: 1, sedeId: 1, eventId: 1 },
      { unique: true, name: "uniq_offline_cash_tenant_event" });
    await db.collection("gruk_offline_stock_movimientos").createIndex(
      { empresaId: 1, sedeId: 1, batchId: 1, productoId: 1 },
      { unique: true, name: "uniq_offline_stock_tenant_batch_product" });
    await db.collection("gruk_ledger_movimientos").createIndex(
      { empresaId: 1, sedeId: 1, eventId: 1, tipo: 1 },
      { unique: true, name: "uniq_offline_ledger_event_type_tenant" });
    await db.collection("inventarios").insertOne({
      empresaId: empresa, sedeId: sede, productoServicioId: producto,
      anulado: false, cantidad: 5
    });
    const inventoryQuery = { empresaId: empresa, sedeId: sede, productoServicioId: producto, anulado: false };
    const totals = async () => ({
      sales: await db.collection("gruk_offline_ventas").countDocuments({ empresaId, sedeId }),
      cash: await db.collection("gruk_offline_caja_intenciones").countDocuments({ empresaId, sedeId }),
      stockJournal: await db.collection("gruk_offline_stock_movimientos").countDocuments({ empresaId, sedeId }),
      ledger: await db.collection("gruk_ledger_movimientos").countDocuments({ empresaId, sedeId }),
      inventory: (await db.collection("inventarios").findOne(inventoryQuery)).cantidad
    });
    const stage = async session => {
      const staged = await stageOfflineFinancialBatch({
        db, session, context, plan, inventoryDeltas: calculateOfflineStockDeltas(plan),
        ledgerMovements: buildOfflineLedgerPlan(plan)
      });
      assertFreshOfflineStaging(staged, deltas, plan);
      const inventory = await applyOfflineLegacyInventory({
        db, session, context, inventoryDeltas: deltas,
        objectId: id => new mongo.ObjectId(id)
      });
      assert.equal(staged.sales.totalCop, "7500");
      assert.equal(staged.cash.totalCop, "7500");
      assert.equal(staged.ledger.totalCop, "7500");
      assert.equal(staged.stock.records.length, 1);
      assert.deepEqual(inventory.map(x => [x.antes, x.despues]), [["5", "3"]]);
    };
    const transactionOptions = { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } };
    const failing = client.startSession();
    try {
      await assert.rejects(
        failing.withTransaction(async () => {
          await stage(failing);
          throw new Error("INJECTED_FAILURE_AFTER_ALL_WRITES");
        }, transactionOptions),
        /INJECTED_FAILURE_AFTER_ALL_WRITES/
      );
    } finally { await failing.endSession(); }
    assert.deepEqual(await totals(), { sales: 0, cash: 0, stockJournal: 0, ledger: 0, inventory: 5 },
      "La falla debe revertir ventas, caja e inventario");

    // Inject a failure AFTER Mongo acknowledges a write in each journal.
    // withTransaction must roll back that write and every preceding journal.
    for (const failedJournal of [
      "gruk_offline_ventas",
      "gruk_offline_stock_movimientos",
      "gruk_offline_caja_intenciones",
      "gruk_ledger_movimientos"
    ]) {
      let injected = 0;
      const failingDb = {
        collection(collectionName) {
          const underlying = db.collection(collectionName);
          if (collectionName !== failedJournal) return underlying;
          return new Proxy(underlying, {
            get(target, property) {
              if (property === "updateOne") {
                return async (...args) => {
                  const result = await target.updateOne(...args);
                  injected++;
                  throw new Error("INJECTED_JOURNAL_FAILURE:" + failedJournal);
                };
              }
              const value = Reflect.get(target, property, target);
              return typeof value === "function" ? value.bind(target) : value;
            }
          });
        }
      };
      const failingJournalSession = client.startSession();
      try {
        await assert.rejects(
          failingJournalSession.withTransaction(() => stageOfflineFinancialBatch({
            db: failingDb, session: failingJournalSession, context, plan,
            inventoryDeltas: calculateOfflineStockDeltas(plan),
            ledgerMovements: buildOfflineLedgerPlan(plan)
          }), transactionOptions),
          new RegExp("INJECTED_JOURNAL_FAILURE:" + failedJournal)
        );
      } finally {
        await failingJournalSession.endSession();
      }
      assert.equal(injected, 1, "The targeted journal must have attempted its write");
      assert.deepEqual(await totals(),
        { sales: 0, cash: 0, stockJournal: 0, ledger: 0, inventory: 5 },
        "Rollback must erase all partial financial staging after " + failedJournal);
    }

    const committed = client.startSession();
    try {
      await committed.withTransaction(() => stage(committed), transactionOptions);
    } finally { await committed.endSession(); }
    assert.deepEqual(await totals(), { sales: 1, cash: 1, stockJournal: 1, ledger: 1, inventory: 3 });
    const cashDoc = await db.collection("gruk_offline_caja_intenciones").findOne({ empresaId, sedeId, eventId });
    assert.equal(cashDoc.cobrado, false, "La intención de caja nunca es un cobro confirmado");
    assert.equal(cashDoc.status, "PENDIENTE_CONCILIACION");
    const ledgerDoc = await db.collection("gruk_ledger_movimientos").findOne({ empresaId, sedeId, eventId });
    assert.equal(ledgerDoc.montoCop, "7500");
    assert.equal(ledgerDoc.deletedAt, null);

    // On identical retries journals attest inserted:false.
    // Staging itself must abort BEFORE any second inventory debit.
    const replay = client.startSession();
    try {
      await assert.rejects(
        replay.withTransaction(async () => {
          // A reused journal is rejected by staging itself, before inventory debit.
          await stageOfflineFinancialBatch({
            db, session: replay, context, plan,
            inventoryDeltas: calculateOfflineStockDeltas(plan),
            ledgerMovements: buildOfflineLedgerPlan(plan)
          });
          throw Error("REPLAY_MUST_NOT_REACH_INVENTORY");
        }, transactionOptions),
        error => error?.code === "OFFLINE_STAGING_TOTAL_CONFLICT"
      );
    } finally { await replay.endSession(); }
    assert.deepEqual(await totals(),
      { sales: 1, cash: 1, stockJournal: 1, ledger: 1, inventory: 3 },
      "El reintento no duplica registros ni descuenta otra vez inventario");
  } finally {
    if (connected) {
      try { await client.db(name).dropDatabase(); } finally { await client.close(); }
    } else await client.close();
  }
});

test("Capa 2 Mongo real: dos tablets compiten por una unidad, solo una contabiliza",{
 skip: !uri && "Requiere replica set MongoDB de pruebas",timeout:90000
},async()=>{
 const {mongo}=require("mongoose");
 const client=new mongo.MongoClient(uri,{serverSelectionTimeoutMS:10000});
 const name="gruk_stock_race_"+randomUUID().replace(/-/g,"");
 const empresa=new mongo.ObjectId(),sede=new mongo.ObjectId(),producto=new mongo.ObjectId();
 const scope={empresaId:empresa.toHexString(),sedeId:sede.toHexString(),actorId:"cajero"};
 const productoId=producto.toHexString();
 const ids=["01ARZ3NDEKTSV4RRFFQ69G5FA0","01ARZ3NDEKTSV4RRFFQ69G5FA1"];
 let connected=false;
 try{
  await client.connect();connected=true;
  const db=client.db(name);
  await Promise.all([
   db.collection("gruk_offline_ventas").createIndex({empresaId:1,sedeId:1,eventId:1},
    {unique:true,name:"uniq_offline_sale_tenant_event"}),
   db.collection("gruk_offline_caja_intenciones").createIndex({empresaId:1,sedeId:1,eventId:1},
    {unique:true,name:"uniq_offline_cash_tenant_event"}),
   db.collection("gruk_offline_stock_movimientos").createIndex(
    {empresaId:1,sedeId:1,batchId:1,productoId:1},
    {unique:true,name:"uniq_offline_stock_tenant_batch_product"}),
   db.collection("gruk_ledger_movimientos").createIndex(
    {empresaId:1,sedeId:1,eventId:1,tipo:1},
    {unique:true,name:"uniq_offline_ledger_event_type_tenant"})
  ]);
  await db.collection("inventarios").insertOne({
   empresaId:empresa,sedeId:sede,productoServicioId:producto,anulado:false,cantidad:1
  });
  const run=async eventId=>{
   const session=client.startSession();
   const plan={orders:[{eventId,localOrderId:eventId,totalCop:"1500",
    items:[{productoId,cantidad:"1"}]}],totalCop:"1500"};
   try{
    return await session.withTransaction(async()=>{
     const deltas=calculateOfflineStockDeltas(plan);
     const staged=await stageOfflineFinancialBatch({
      db,session,context:scope,plan,inventoryDeltas:deltas,
      ledgerMovements:buildOfflineLedgerPlan(plan)
     });
     assertFreshOfflineStaging(staged,deltas,plan);
     await applyOfflineLegacyInventory({
      db,session,context:scope,inventoryDeltas:deltas,
      objectId:id=>new mongo.ObjectId(id)
     });
     return eventId;
    },{readConcern:{level:"snapshot"},writeConcern:{w:"majority"}});
   }finally{await session.endSession();}
  };
  const results=await Promise.allSettled(ids.map(run));
  const successes=results.filter(x=>x.status==="fulfilled");
  const failures=results.filter(x=>x.status==="rejected");
  assert.equal(successes.length,1,JSON.stringify(results));
  assert.equal(failures.length,1,JSON.stringify(results));
  assert(["OFFLINE_INVENTORY_INSUFFICIENT","OFFLINE_INVENTORY_CONCURRENT_CHANGE"].includes(
   failures[0].reason?.code),String(failures[0].reason));
  const winner=successes[0].value;
  const journalCollections=[
   "gruk_offline_ventas","gruk_offline_stock_movimientos",
   "gruk_offline_caja_intenciones","gruk_ledger_movimientos"
  ];
  for(const collection of journalCollections){
   assert.equal(await db.collection(collection).countDocuments({empresaId:scope.empresaId,
    sedeId:scope.sedeId}),1,collection);
  }
  const sale=await db.collection("gruk_offline_ventas").findOne({
   empresaId:scope.empresaId,sedeId:scope.sedeId});
  assert.equal(sale.eventId,winner);
  assert.equal((await db.collection("inventarios").findOne({
   empresaId:empresa,sedeId:sede,productoServicioId:producto})).cantidad,0);
 }finally{
  if(connected){try{await client.db(name).dropDatabase();}finally{await client.close();}}
  else await client.close();
 }
});
