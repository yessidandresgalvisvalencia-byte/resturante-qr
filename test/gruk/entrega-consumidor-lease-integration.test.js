"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

test("expired consumer lease is reclaimable and stale owner cannot ACK or release", {
  skip: !process.env.TEST_MONGO_URI
}, async () => {
  const mongoose = require("mongoose");
  const Outbox = require("../../models/GrukOutboxEvent");
  const Entrega = require("../../models/GrukEntregaConsumidor");
  const { reclamarEntrega, confirmarEntrega, liberarEntrega } =
    require("../../core/eventos/entregaConsumidor.service");
  await mongoose.connect(process.env.TEST_MONGO_URI, { dbName: "gruk_consumer_lease_test" });
  const empresaId = new mongoose.Types.ObjectId();
  const ventaId = new mongoose.Types.ObjectId();
  try {
    await Promise.all([Outbox.init(), Entrega.init()]);
    const event = await Outbox.create({
      empresaId, aggregateId: ventaId, eventName: "VENTA_COMPLETADA",
      payload: { empresaId, ventaId, total: 1000 }
    });
    await Entrega.create({
      empresaId, eventId: event._id, consumidor: "CAJA_VENTA_V1"
    });
    const t0 = new Date();
    const first = await reclamarEntrega({
      empresaId, eventId: event._id, consumidor: "CAJA_VENTA_V1", now: t0
    });
    assert.equal(first.reclamada, true);
    const second = await reclamarEntrega({
      empresaId, eventId: event._id, consumidor: "CAJA_VENTA_V1",
      now: new Date(t0.getTime() + 61000)
    });
    assert.equal(second.reclamada, true);
    assert.notEqual(first.leaseToken, second.leaseToken);
    assert.equal((await confirmarEntrega({
      empresaId, eventId: event._id, consumidor: "CAJA_VENTA_V1",
      leaseToken: first.leaseToken, now: new Date(t0.getTime() + 61001)
    })).confirmado, false);
    assert.equal((await liberarEntrega({
      empresaId, eventId: event._id, consumidor: "CAJA_VENTA_V1",
      leaseToken: first.leaseToken, error: "stale"
    })).liberado, false);
    assert.equal((await confirmarEntrega({
      empresaId, eventId: event._id, consumidor: "CAJA_VENTA_V1",
      leaseToken: second.leaseToken, now: new Date(t0.getTime() + 61002)
    })).confirmado, true);
    const saved = await Entrega.findOne({
      empresaId, eventId: event._id, consumidor: "CAJA_VENTA_V1"
    }).lean();
    assert.equal(saved.estado, "ENTREGADO");
    assert.equal(saved.intentos, 2);
    assert.equal((await reclamarEntrega({ empresaId, eventId: event._id,
      consumidor: "CAJA_VENTA_V1", now: new Date(t0.getTime() + 122000) })).reclamada, false);
    assert.equal((await confirmarEntrega({ empresaId, eventId: event._id,
      consumidor: "CAJA_VENTA_V1", leaseToken: second.leaseToken,
      now: new Date(t0.getTime() + 61003) })).confirmado, false);
  } finally {
    await mongoose.disconnect();
  }
});


test("closed parent refuses pending consumer claim", {
  skip: !process.env.TEST_MONGO_URI
}, async () => {
  const mongoose = require("mongoose");
  const Outbox = require("../../models/GrukOutboxEvent");
  const Entrega = require("../../models/GrukEntregaConsumidor");
  const { reclamarEntrega } = require("../../core/eventos/entregaConsumidor.service");
  await mongoose.connect(process.env.TEST_MONGO_URI, { dbName: "gruk_closed_claim_test" });
  try {
    await Promise.all([Outbox.init(), Entrega.init()]);
    const empresaId = new mongoose.Types.ObjectId();
    const ventaId = new mongoose.Types.ObjectId();
    const event = await Outbox.create({
      empresaId, aggregateId: ventaId, eventName: "VENTA_COMPLETADA",
      estado: "ENTREGADO", payload: { empresaId, ventaId }
    });
    await Entrega.create({
      empresaId, eventId: event._id, consumidor: "CAJA_VENTA_V1"
    });
    const result = await reclamarEntrega({ empresaId, eventId: event._id,
      consumidor: "CAJA_VENTA_V1" });
    assert.deepEqual(result, { reclamada: false });
    const delivery = await Entrega.findOne({ empresaId, eventId: event._id });
    assert.equal(delivery.estado, "PENDIENTE");
    assert.equal(delivery.intentos, 0);
  } finally {
    await mongoose.disconnect();
  }
});


test("processing parent outbox cannot issue consumer lease", {
  skip: !process.env.TEST_MONGO_URI
}, async () => {
  const mongoose = require("mongoose");
  const Outbox = require("../../models/GrukOutboxEvent");
  const Entrega = require("../../models/GrukEntregaConsumidor");
  const { reclamarEntrega } = require("../../core/eventos/entregaConsumidor.service");
  await mongoose.connect(process.env.TEST_MONGO_URI, { dbName: "gruk_processing_parent_claim_test" });
  try {
    await Promise.all([Outbox.init(), Entrega.init()]);
    const empresaId = new mongoose.Types.ObjectId();
    const ventaId = new mongoose.Types.ObjectId();
    const event = await Outbox.create({
      empresaId, aggregateId: ventaId, eventName: "VENTA_COMPLETADA",
      estado: "PROCESANDO", payload: { empresaId, ventaId }
    });
    await Entrega.create({ empresaId, eventId: event._id, consumidor: "CAJA_VENTA_V1" });
    assert.deepEqual(await reclamarEntrega({ empresaId, eventId: event._id,
      consumidor: "CAJA_VENTA_V1" }), { reclamada: false });
    const delivery = await Entrega.findOne({ empresaId, eventId: event._id });
    assert.equal(delivery.estado, "PENDIENTE");
    assert.equal(delivery.intentos, 0);
  } finally {
    await mongoose.disconnect();
  }
});


test("concurrent claims grant one lease and keep one durable owner", {
  skip: !process.env.TEST_MONGO_URI
}, async () => {
  const mongoose = require("mongoose");
  const Outbox = require("../../models/GrukOutboxEvent");
  const Entrega = require("../../models/GrukEntregaConsumidor");
  const { reclamarEntrega } = require("../../core/eventos/entregaConsumidor.service");
  await mongoose.connect(process.env.TEST_MONGO_URI, { dbName: "gruk_concurrent_claim_test" });
  try {
    await Promise.all([Outbox.init(), Entrega.init()]);
    const empresaId = new mongoose.Types.ObjectId();
    const ventaId = new mongoose.Types.ObjectId();
    const event = await Outbox.create({
      empresaId, aggregateId: ventaId, eventName: "VENTA_COMPLETADA",
      payload: { empresaId, ventaId }
    });
    await Entrega.create({ empresaId, eventId: event._id, consumidor: "CAJA_VENTA_V1" });
    const results = await Promise.allSettled(Array.from({ length: 8 }, () =>
      reclamarEntrega({ empresaId, eventId: event._id, consumidor: "CAJA_VENTA_V1" })));
    const winners = results.filter(x => x.status === "fulfilled" && x.value.reclamada);
    assert.equal(winners.length, 1);
    const saved = await Entrega.findOne({ empresaId, eventId: event._id }).lean();
    assert.equal(saved.estado, "PROCESANDO");
    assert.equal(saved.intentos, 1);
    assert.equal(saved.leaseToken, winners[0].value.leaseToken);
    assert.equal((await Outbox.findById(event._id)).registroVersion, 1);
  } finally {
    await mongoose.disconnect();
  }
});


test("non-claimable active lease does not mutate parent version or attempt count", {
  skip: !process.env.TEST_MONGO_URI
}, async () => {
  const mongoose = require("mongoose");
  const Outbox = require("../../models/GrukOutboxEvent");
  const Entrega = require("../../models/GrukEntregaConsumidor");
  const { reclamarEntrega } = require("../../core/eventos/entregaConsumidor.service");
  await mongoose.connect(process.env.TEST_MONGO_URI, { dbName: "gruk_claim_noop_test" });
  try {
    await Promise.all([Outbox.init(), Entrega.init()]);
    const empresaId = new mongoose.Types.ObjectId();
    const ventaId = new mongoose.Types.ObjectId();
    const event = await Outbox.create({
      empresaId, aggregateId: ventaId, eventName: "VENTA_COMPLETADA",
      payload: { empresaId, ventaId }
    });
    await Entrega.create({ empresaId, eventId: event._id, consumidor: "CAJA_VENTA_V1" });
    const now = new Date();
    const first = await reclamarEntrega({ empresaId, eventId: event._id,
      consumidor: "CAJA_VENTA_V1", now });
    assert.equal(first.reclamada, true);
    const second = await reclamarEntrega({ empresaId, eventId: event._id,
      consumidor: "CAJA_VENTA_V1", now: new Date(now.getTime() + 1000) });
    assert.deepEqual(second, { reclamada: false, motivo: "ESPERAR" });
    const saved = await Entrega.findOne({ empresaId, eventId: event._id }).lean();
    assert.equal(saved.intentos, 1);
    assert.equal(saved.leaseToken, first.leaseToken);
    assert.equal((await Outbox.findById(event._id)).registroVersion, 1);
  } finally {
    await mongoose.disconnect();
  }
});
