"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

test("outbox redelivery does not duplicate committed consumer effects", {
  skip: !process.env.TEST_MONGO_URI
}, async () => {
  const mongoose = require("mongoose");
  const OutboxEvent = require("../../models/GrukOutboxEvent");
  const Recibo = require("../../models/GrukEventoProcesado");
  const { despacharSiguienteVenta } = require("../../core/eventos/ventaOutbox.dispatcher");
  const { consumirEventoUnaVez } = require("../../core/eventos/consumidorIdempotente.service");
  await mongoose.connect(process.env.TEST_MONGO_URI, { dbName: "gruk_ci_outbox_consumer" });
  const efectos = mongoose.connection.db.collection("gruk_outbox_consumer_effects");
  try {
    await Promise.all([OutboxEvent.init(), Recibo.init()]);
    const empresaId = new mongoose.Types.ObjectId();
    const ventaId = new mongoose.Types.ObjectId();
    const evento = await OutboxEvent.create({
      empresaId, aggregateId: ventaId, eventName: "VENTA_COMPLETADA",
      payload: { ventaId, empresaId }
    });
    const consumidor = "ci-finanzas-" + ventaId;
    let intentosDeEntrega = 0;
    const emitir = async (_nombre, _payload, metadata) => {
      const resultado = await consumirEventoUnaVez({
        eventId: metadata.eventId,
        empresaId: metadata.empresaId,
        consumidor,
        aplicar: async ({ session }) => {
          await efectos.insertOne({ empresaId, ventaId, eventId: evento._id }, { session });
        }
      });
      intentosDeEntrega += 1;
      if (intentosDeEntrega === 1) {
        assert.equal(resultado.aplicado, true);
        throw new Error("CAIDA_DESPUES_DE_COMMIT_CONSUMIDOR");
      }
      assert.equal(resultado.duplicado, true);
    };
    await assert.rejects(despacharSiguienteVenta({ emitir }), /CAIDA_DESPUES_DE_COMMIT_CONSUMIDOR/);
    assert.equal((await OutboxEvent.findById(evento._id)).estado, "PENDIENTE");
    assert.equal(await efectos.countDocuments({ eventId: evento._id }), 1);
    assert.equal(await Recibo.countDocuments({ eventId: evento._id, consumidor }), 1);

    const recuperado = await despacharSiguienteVenta({ emitir });
    assert.equal(recuperado.entregado, true);
    assert.equal(intentosDeEntrega, 2);
    assert.equal(await efectos.countDocuments({ eventId: evento._id }), 1);
    assert.equal(await Recibo.countDocuments({ eventId: evento._id, consumidor }), 1);
    assert.equal((await OutboxEvent.findById(evento._id)).estado, "ENTREGADO");
  } finally {
    await mongoose.disconnect();
  }
});
