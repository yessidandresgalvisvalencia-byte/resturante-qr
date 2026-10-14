"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { crearProcesadorIdempotente } = require("../../services/p0/procesadorEventosIdempotente");

test("MongoDB ACID: entrega repetida de evento aplica ingreso solo una vez", async (t) => {
  if (!process.env.TEST_MONGO_URI) { t.skip("TEST_MONGO_URI requerido"); return; }
  const conn = await mongoose.createConnection(process.env.TEST_MONGO_URI, {
    dbName: "gruk_test_ingreso_idempotente", serverSelectionTimeoutMS: 5000
  }).asPromise();
  const empresaId = new mongoose.Types.ObjectId();
  const evento = "VENTA_COMPLETADA:" + new mongoose.Types.ObjectId().toHexString();
  const receiptSchema = new mongoose.Schema({
    empresaId: mongoose.Schema.Types.ObjectId, consumidor: String, eventId: String
  }, { collection: "recibos" });
  receiptSchema.index({ empresaId: 1, consumidor: 1, eventId: 1 }, { unique: true });
  const Receipt = conn.model("TestReceipt", receiptSchema);
  const Ingreso = conn.collection("ingresos");
  try {
    await Receipt.init();
    const processor = crearProcesadorIdempotente({
      Receipt,
      mongooseInstance: {
        isValidObjectId: mongoose.isValidObjectId,
        startSession: () => conn.startSession()
      }
    });
    const ejecutar = () => processor({
      empresaId, consumidor: "finanzas_wompi_p0", eventId: evento,
      aplicar: async ({ session }) => {
        await Ingreso.insertOne({ empresaId, eventId: evento, importeCentavos: 5200000 }, { session });
      }
    });
    const first = await ejecutar();
    const second = await ejecutar();
    assert.equal(first.applied, true);
    assert.equal(second.applied, false);
    assert.equal(second.replayed, true);
    assert.equal(await Ingreso.countDocuments({ empresaId, eventId: evento }), 1);
    assert.equal(await Receipt.countDocuments({ empresaId, eventId: evento }), 1);
  } finally {
    await conn.dropDatabase();
    await conn.close();
  }
});
