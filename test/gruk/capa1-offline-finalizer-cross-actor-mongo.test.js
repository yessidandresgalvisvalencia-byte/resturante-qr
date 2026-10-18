"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { markOfflineApplied } = require("../../core/offline/offlineApply.service");
const uri = process.env.GRUK_TEST_MONGO_URI || process.env.TEST_MONGO_URI;

test("MongoDB real: cierre offline bloqueado por asientos de otro operador, sin escrituras parciales", {
  skip: !uri && "Requiere MongoDB replica set de pruebas", timeout: 45000
}, async () => {
  const { mongo } = require("mongoose");
  const client = new mongo.MongoClient(uri, {serverSelectionTimeoutMS:10000});
  const name = "gruk_apply_actor_" + randomUUID().replace(/-/g,"");
  const context = {empresaId:"empresa-a",sedeId:"sede-a",actorId:"operador-a",canReview:true};
  const eventId = "01ARZ3NDEKTSV4RRFFQ69G5FA0";
  const reviewToken = "12345678-1234-4abc-8def-123456789abc";
  const ref = {collection:"gruk_ledger_movimientos",eventId};
  const key = {empresaId:context.empresaId,sedeId:context.sedeId,eventId,actorId:context.actorId};
  let connected = false;
  try {
    await client.connect(); connected = true;
    const db = client.db(name);
    const scoped = {client,collection:collection=>db.collection(collection)};
    await db.collection("gruk_offline_inbox").insertOne({
      ...key,status:"EN_REVISION",reviewToken,reviewActorId:context.actorId,inventoryApplied:true
    });
    await db.collection("gruk_offline_ventas").insertOne({...key,status:"CONTABILIZADA",totalCop:"12000"});
    await db.collection("gruk_offline_caja_intenciones").insertOne({
      ...key,status:"CONCILIADO",cobrado:true,montoCop:"12000"
    });
    await db.collection("gruk_ledger_movimientos").insertOne({
      ...key,tipo:"VENTA_OFFLINE",deletedAt:null,montoCop:"12000"
    });

    const inboxState = async () => db.collection("gruk_offline_inbox").findOne(key);
    const reject = async () => {
      await assert.rejects(markOfflineApplied({db:scoped,context,eventId,reviewToken,commitReference:ref}),
        error=>error?.message==="OFFLINE_DOMAIN_NOT_COMMITTED");
      const inbox = await inboxState();
      assert.equal(inbox.status,"EN_REVISION");
      assert.equal(inbox.appliedAt,undefined);
      assert.equal(inbox.inventoryApplied,true);
    };
    for (const [collection,attrs] of [
      ["gruk_ledger_movimientos",{tipo:"OTRO_ASIENTO",montoCop:"12000",deletedAt:null}],
      ["gruk_offline_ventas",{status:"CONTABILIZADA",totalCop:"12000"}],
      ["gruk_offline_caja_intenciones",{status:"CONCILIADO",cobrado:true,montoCop:"12000"}]
    ]) {
      const foreign = await db.collection(collection).insertOne({...key,actorId:"operador-b",...attrs});
      try { await reject(); }
      finally { await db.collection(collection).deleteOne({_id:foreign.insertedId}); }
    }
    // A valid event from another company or site must not deny this tenant's closure.
    const outsiders = await db.collection("gruk_ledger_movimientos").insertMany([
      {...key,empresaId:"empresa-b",actorId:"operador-b",tipo:"OTRO_ASIENTO",deletedAt:null,montoCop:"12000"},
      {...key,sedeId:"sede-b",actorId:"operador-b",tipo:"OTRO_ASIENTO",deletedAt:null,montoCop:"12000"}
    ]);
    assert.equal(Object.keys(outsiders.insertedIds).length,2);
    const complete = await markOfflineApplied({db:scoped,context,eventId,reviewToken,commitReference:ref});
    assert.equal(complete.status,"APLICADO");
    assert.equal((await inboxState()).status,"APLICADO");
    assert.equal(await db.collection("gruk_offline_inbox").countDocuments({...key,status:"APLICADO"}),1);
    const retry = await markOfflineApplied({db:scoped,context,eventId,reviewToken,commitReference:ref});
    assert.equal(retry.status,"NO_RECLAMADO");
    for (const collection of ["gruk_offline_ventas","gruk_offline_caja_intenciones","gruk_ledger_movimientos"])
      assert.equal(await db.collection(collection).countDocuments(key),1);
  } finally {
    if(connected){try{await client.db(name).dropDatabase();}finally{await client.close();}}
    else await client.close();
  }
});
