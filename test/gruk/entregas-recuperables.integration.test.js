"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

test("recovery discovery only returns pending or expired deliveries for eligible parent and tenant", {
  skip: !process.env.TEST_MONGO_URI
}, async () => {
  const mongoose = require("mongoose");
  const Outbox = require("../../models/GrukOutboxEvent");
  const Entrega = require("../../models/GrukEntregaConsumidor");
  const { listarEntregasRecuperables } = require("../../core/eventos/listarEntregasRecuperables.service");
  await mongoose.connect(process.env.TEST_MONGO_URI, { dbName: "gruk_recovery_discovery_test" });
  try {
    await Promise.all([Outbox.init(), Entrega.init()]);
    const empresaId = new mongoose.Types.ObjectId();
    const otraEmpresaId = new mongoose.Types.ObjectId();
    const now = new Date("2026-04-01T12:00:00.000Z");
    async function seed(tenant, parentState, childState, leaseHasta = null) {
      const ventaId = new mongoose.Types.ObjectId();
      const parent = await Outbox.create({
        empresaId: tenant, aggregateId: ventaId, eventName: "VENTA_COMPLETADA",
        estado: parentState, payload: { empresaId: tenant, ventaId }
      });
      await Entrega.create({
        empresaId: tenant, eventId: parent._id, consumidor: "CAJA_VENTA_V1",
        estado: childState, leaseHasta
      });
      return parent._id;
    }
    const pending = await seed(empresaId, "PENDIENTE", "PENDIENTE");
    const expired = await seed(empresaId, "PENDIENTE", "PROCESANDO", new Date(now.getTime() - 1000));
    await seed(empresaId, "PENDIENTE", "PROCESANDO", new Date(now.getTime() + 60000));
    await seed(empresaId, "ENTREGADO", "PENDIENTE");
    await seed(empresaId, "PROCESANDO", "PENDIENTE");
    await seed(otraEmpresaId, "PENDIENTE", "PENDIENTE");
    const results = await listarEntregasRecuperables({
      empresaId, consumidor: "CAJA_VENTA_V1", now, limit: 20
    });
    assert.deepEqual(new Set(results.map(x => String(x.eventId))),
      new Set([String(pending), String(expired)]));
    assert.ok(results.every(x => String(x.empresaId) === String(empresaId)));
    assert.equal((await Entrega.findOne({ eventId: pending })).estado, "PENDIENTE");
    await assert.rejects(
      listarEntregasRecuperables({ empresaId, consumidor: "UNKNOWN", now }),
      /ENTREGA_RECUPERACION_PARAMETROS_INVALIDOS/
    );
  } finally {
    await mongoose.disconnect();
  }
});


test("recovery discovery does not let a closed parent consume the only result slot", {
  skip: !process.env.TEST_MONGO_URI
}, async () => {
  const mongoose = require("mongoose");
  const Outbox = require("../../models/GrukOutboxEvent");
  const Entrega = require("../../models/GrukEntregaConsumidor");
  const { listarEntregasRecuperables } = require("../../core/eventos/listarEntregasRecuperables.service");
  await mongoose.connect(process.env.TEST_MONGO_URI, { dbName: "gruk_recovery_starvation_test" });
  try {
    await Promise.all([Outbox.init(), Entrega.init()]);
    const empresaId = new mongoose.Types.ObjectId();
    async function seed(state) {
      const ventaId = new mongoose.Types.ObjectId();
      const event = await Outbox.create({ empresaId, aggregateId: ventaId,
        eventName: "VENTA_COMPLETADA", estado: state, payload: { empresaId, ventaId } });
      await Entrega.create({ empresaId, eventId: event._id, consumidor: "CAJA_VENTA_V1" });
      return event;
    }
    await seed("ENTREGADO");
    const eligible = await seed("PENDIENTE");
    const found = await listarEntregasRecuperables({ empresaId,
      consumidor: "CAJA_VENTA_V1", limit: 1 });
    assert.equal(found.length, 1);
    assert.equal(String(found[0].eventId), String(eligible._id));
  } finally {
    await mongoose.disconnect();
  }
});


test("keyset recovery scans past more than 100 ineligible parent events", {
  skip: !process.env.TEST_MONGO_URI
}, async () => {
  const mongoose = require("mongoose");
  const Outbox = require("../../models/GrukOutboxEvent");
  const Entrega = require("../../models/GrukEntregaConsumidor");
  const { listarEntregasRecuperables } = require("../../core/eventos/listarEntregasRecuperables.service");
  await mongoose.connect(process.env.TEST_MONGO_URI, { dbName: "gruk_recovery_keyset_test" });
  try {
    await Promise.all([Outbox.init(), Entrega.init()]);
    const empresaId = new mongoose.Types.ObjectId();
    const parents = Array.from({ length: 125 }, () => {
      const ventaId = new mongoose.Types.ObjectId();
      return { empresaId, aggregateId: ventaId, eventName: "VENTA_COMPLETADA",
        estado: "ENTREGADO", payload: { empresaId, ventaId } };
    });
    const created = await Outbox.insertMany(parents, { ordered: true });
    await Entrega.insertMany(created.map(event => ({ empresaId,
      eventId: event._id, consumidor: "CAJA_VENTA_V1" })), { ordered: true });
    const ventaId = new mongoose.Types.ObjectId();
    const target = await Outbox.create({ empresaId, aggregateId: ventaId,
      eventName: "VENTA_COMPLETADA", payload: { empresaId, ventaId } });
    await Entrega.create({ empresaId, eventId: target._id, consumidor: "CAJA_VENTA_V1" });
    const found = await listarEntregasRecuperables({ empresaId,
      consumidor: "CAJA_VENTA_V1", limit: 1 });
    assert.equal(found.length, 1);
    assert.equal(String(found[0].eventId), String(target._id));
  } finally {
    await mongoose.disconnect();
  }
});


test("recovery keyset index is declared for tenant and consumer scan", () => {
  const Entrega = require("../../models/GrukEntregaConsumidor");
  const keys = Entrega.schema.indexes().map(([fields]) => fields);
  assert.ok(keys.some(fields => fields.empresaId === 1 &&
    fields.consumidor === 1 && fields._id === 1));
});
