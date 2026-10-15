"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { crearProcesadorIdempotente } = require("../../services/p0/procesadorEventosIdempotente");

test("Un worker reiniciado no duplica ingresos tras commit financiero sin ACK Outbox", async (t) => {
  if (!process.env.TEST_MONGO_URI) { t.skip("TEST_MONGO_URI requerido"); return; }
  const connection = await mongoose.createConnection(process.env.TEST_MONGO_URI, {
    dbName: "gruk_test_worker_replay_after_crash", serverSelectionTimeoutMS: 5000
  }).asPromise();
  const empresaId = new mongoose.Types.ObjectId();
  const eventId = "VENTA_COMPLETADA:" + new mongoose.Types.ObjectId().toHexString();
  const receiptSchema = new mongoose.Schema({
    empresaId: mongoose.Schema.Types.ObjectId, consumidor: String, eventId: String
  }, { collection: "recibos" });
  receiptSchema.index({ empresaId: 1, consumidor: 1, eventId: 1 }, { unique: true });
  const Receipt = connection.model("CrashReceipt", receiptSchema);
  const outbox = connection.collection("outbox_replay");
  const ingresos = connection.collection("ingresos_replay");
  try {
    await Receipt.init();
    await outbox.insertOne({ eventId, status: "CLAIMED", claimedBy: "worker-caido", claimToken: "original", leaseUntil: new Date(Date.now()-1000), nextAttemptAt: new Date(Date.now()-1000) });
    const processor = crearProcesadorIdempotente({
      Receipt, mongooseInstance: { isValidObjectId: mongoose.isValidObjectId, startSession: () => connection.startSession() }
    });
    const aplicar = () => processor({
      empresaId, consumidor: "finanzas_wompi_p0", eventId,
      aplicar: async ({session}) => {
        await ingresos.insertOne({empresaId,eventId,importeCentavos:5200000}, {session});
      }
    });
    assert.equal((await aplicar()).applied,true);
    // Simula caída antes del ACK del primer worker: evento persiste en CLAIMED.
    assert.equal((await outbox.findOne({eventId})).status,"CLAIMED");
    const now = new Date();
    const reclaimed = await outbox.findOneAndUpdate(
      { eventId, status:"CLAIMED", leaseUntil:{$lte:now} },
      { $set:{claimedBy:"worker-reiniciado",claimToken:"replay",leaseUntil:new Date(now.getTime()+60000)} },
      {returnDocument:"after"}
    );
    assert.equal(reclaimed.claimedBy,"worker-reiniciado");
    const replay = await aplicar();
    assert.equal(replay.applied,false);
    assert.equal(replay.replayed,true);
    const ack = await outbox.updateOne({eventId,claimedBy:"worker-reiniciado",claimToken:"replay",status:"CLAIMED"},{$set:{status:"DONE"}});
    assert.equal(ack.modifiedCount,1);
    assert.equal(await ingresos.countDocuments({eventId}),1);
    assert.equal(await Receipt.countDocuments({eventId}),1);
  } finally {
    await connection.dropDatabase();
    await connection.close();
  }
});
