"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { readOfflineReconciliation } = require("../../core/offline/offlineReconciliation.service");
const { readOfflineStatuses } = require("../../core/offline/offlineStatus.service");
const uri = process.env.GRUK_TEST_MONGO_URI || process.env.TEST_MONGO_URI;

test("MongoDB real: operador ajeno contamina comprobante sin validar pedido offline", {
  skip: !uri && "Requiere MongoDB de pruebas aislado", timeout: 45000
}, async () => {
  const { mongo } = require("mongoose");
  const client = new mongo.MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  const name = "gruk_cross_actor_rec_" + randomUUID().replace(/-/g, "");
  const context = { empresaId:"empresa-a", sedeId:"sede-a", actorId:"operador-a" };
  const eventId = "01ARZ3NDEKTSV4RRFFQ69G5FA0";
  const key = {...context,eventId};
  const proof = {...key};
  let connected = false;
  try {
    await client.connect();
    connected = true;
    const db = client.db(name);
    await db.collection("gruk_offline_inbox").insertOne({...key,status:"APLICADO",inventoryApplied:true});
    await db.collection("gruk_offline_ventas").insertOne({...proof,status:"CONTABILIZADA",totalCop:"8500"});
    await db.collection("gruk_offline_caja_intenciones").insertOne({...proof,status:"CONCILIADO",montoCop:"8500",cobrado:true});
    await db.collection("gruk_ledger_movimientos").insertOne({...proof,tipo:"VENTA_OFFLINE",montoCop:"8500",deletedAt:null});
    const read = async ctx => (await readOfflineReconciliation({db,context:ctx,eventIds:[eventId]}))[0];
    const status = async ctx => (await readOfflineStatuses({db,context:ctx,eventIds:[eventId]}))[0];
    assert.deepEqual(await read(context), {
      eventId,status:"APLICADO",staged:true,financiallyReconciled:true,applied:true
    });
    assert.equal((await status(context)).applied,true);

    const foreign = {...proof,actorId:"operador-b"};
    const inserted = await db.collection("gruk_ledger_movimientos").insertOne({
      ...foreign,tipo:"OTRO_ASIENTO",montoCop:"8500",deletedAt:null
    });
    assert.deepEqual(await read(context), {
      eventId,status:"APLICADO",staged:false,financiallyReconciled:false,applied:false
    });
    assert.equal((await status(context)).applied,false,
      "No confirmar tablet con un asiento de otro operador para el mismo evento");
    assert.deepEqual(await read({...context,actorId:"operador-b"}), {
      eventId,status:"NO_ENCONTRADO",staged:false,financiallyReconciled:false,applied:false
    });

    await db.collection("gruk_ledger_movimientos").deleteOne({_id:inserted.insertedId});
    assert.equal((await read(context)).applied,true);
    const wrongCompany = await db.collection("gruk_ledger_movimientos").insertOne({
      ...foreign,empresaId:"empresa-b",tipo:"OTRO_ASIENTO",montoCop:"8500",deletedAt:null
    });
    const wrongSite = await db.collection("gruk_ledger_movimientos").insertOne({
      ...foreign,sedeId:"sede-b",tipo:"OTRO_ASIENTO",montoCop:"8500",deletedAt:null
    });
    assert.equal((await read(context)).applied,true,
      "Las pruebas ajenas a la empresa o sede no contaminan el evento autorizado");
    await db.collection("gruk_ledger_movimientos").deleteMany({
      _id:{$in:[wrongCompany.insertedId,wrongSite.insertedId]}
    });

    // Repeat for sales and cash; any extra proof, even from a different actor,
    // invalidates reconciliation and cannot be acknowledged to the tablet.
    for (const [collection,extra] of [
      ["gruk_offline_ventas",{status:"CONTABILIZADA",totalCop:"8500"}],
      ["gruk_offline_caja_intenciones",{status:"CONCILIADO",montoCop:"8500",cobrado:true}]
    ]) {
      const added = await db.collection(collection).insertOne({...foreign,...extra});
      assert.equal((await read(context)).applied,false,collection);
      assert.equal((await status(context)).applied,false,collection);
      await db.collection(collection).deleteOne({_id:added.insertedId});
      assert.equal((await read(context)).applied,true);
    }
  } finally {
    if (connected) {
      try { await client.db(name).dropDatabase(); } finally { await client.close(); }
    } else await client.close();
  }
});
