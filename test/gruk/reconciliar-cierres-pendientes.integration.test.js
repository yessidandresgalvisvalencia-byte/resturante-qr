"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

test("reconciliation closes fully acknowledged parent and leaves partial parent pending", {
  skip: !process.env.TEST_MONGO_URI
}, async () => {
  const mongoose = require("mongoose");
  const Outbox = require("../../models/GrukOutboxEvent");
  const Entrega = require("../../models/GrukEntregaConsumidor");
  const { reconciliarCierresPendientes } = require("../../core/eventos/reconciliarCierresPendientes.service");
  await mongoose.connect(process.env.TEST_MONGO_URI, { dbName: "gruk_reconcile_pending_parents_test" });
  try {
    await Promise.all([Outbox.init(), Entrega.init()]);
    const empresaId = new mongoose.Types.ObjectId();
    const otherTenant = new mongoose.Types.ObjectId();
    async function seed(tenant, facturacionState) {
      const ventaId = new mongoose.Types.ObjectId();
      const event = await Outbox.create({
        empresaId: tenant, aggregateId: ventaId, eventName: "VENTA_COMPLETADA",
        payload: { empresaId: tenant, ventaId }
      });
      await Entrega.create([
        { empresaId: tenant, eventId: event._id, consumidor: "CAJA_VENTA_V1", estado: "ENTREGADO" },
        { empresaId: tenant, eventId: event._id, consumidor: "FACTURACION_VENTA_V1",
          estado: facturacionState }
      ], { ordered: true });
      return event;
    }
    const complete = await seed(empresaId, "ENTREGADO");
    const incomplete = await seed(empresaId, "PENDIENTE");
    const foreign = await seed(otherTenant, "ENTREGADO");
    const result = await reconciliarCierresPendientes({ empresaId, limit: 10 });
    assert.equal(result.examinados, 2);
    assert.equal((await Outbox.findById(complete._id)).estado, "ENTREGADO");
    assert.equal((await Outbox.findById(incomplete._id)).estado, "PENDIENTE");
    assert.equal((await Outbox.findById(foreign._id)).estado, "PENDIENTE");
    assert.equal((await reconciliarCierresPendientes({ empresaId, limit: 10 })).examinados, 1);
    await assert.rejects(reconciliarCierresPendientes({ empresaId, limit: 101 }),
      /OUTBOX_RECONCILIACION_PARAMETROS_INVALIDOS/);
  } finally {
    await mongoose.disconnect();
  }
});
