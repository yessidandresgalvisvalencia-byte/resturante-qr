"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

test("Caja durable adapter exports a callable consumer without starting a worker", () => {
  const { consumirVentaEnCaja } = require("../../core/eventos/cajaVenta.consumer");
  assert.equal(typeof consumirVentaEnCaja, "function");
});

test("Caja durable adapter rejects malformed outbox identities before writing", async () => {
  const { consumirVentaEnCaja } = require("../../core/eventos/cajaVenta.consumer");
  await assert.rejects(
    consumirVentaEnCaja({ eventId: "invalid", empresaId: "invalid" }),
    /CONSUMIDOR_IDENTIDAD_INVALIDA/
  );
});

test("Caja durable consumer commits one movement and one receipt on retry", {
  skip: !process.env.TEST_MONGO_URI
}, async () => {
  const mongoose = require("mongoose");
  const Outbox = require("../../models/GrukOutboxEvent");
  const Receipt = require("../../models/GrukEventoProcesado");
  const Movimiento = require("../../core/finanzas/models/MovimientoCaja");
  const { consumirVentaEnCaja } = require("../../core/eventos/cajaVenta.consumer");
  await mongoose.connect(process.env.TEST_MONGO_URI, { dbName: "gruk_caja_durable_test" });
  const empresaId = new mongoose.Types.ObjectId();
  const ventaId = new mongoose.Types.ObjectId();
  try {
    await Promise.all([Outbox.init(), Receipt.init(), Movimiento.init()]);
    const event = await Outbox.create({
      empresaId, aggregateId: ventaId, eventName: "VENTA_COMPLETADA",
      payload: { empresaId, ventaId, total: 12000, metodoPago: "",
        fecha: new Date(), sourceUpdatedAt: new Date() }
    });
    const first = await consumirVentaEnCaja({ eventId: event._id, empresaId });
    const second = await consumirVentaEnCaja({ eventId: event._id, empresaId });
    assert.equal(first.aplicado, true);
    assert.equal(second.duplicado, true);
    assert.equal(await Movimiento.countDocuments({ empresaId, origenId: ventaId }), 1);
    assert.equal(await Receipt.countDocuments({ empresaId, eventId: event._id, consumidor: "CAJA_VENTA_V1" }), 1);
  } finally {
    await mongoose.disconnect();
  }
});

test("Caja durable consumer rolls back the receipt if its movement cannot be created", {
  skip: !process.env.TEST_MONGO_URI
}, async () => {
  const mongoose = require("mongoose");
  const Outbox = require("../../models/GrukOutboxEvent");
  const Receipt = require("../../models/GrukEventoProcesado");
  const Movimiento = require("../../core/finanzas/models/MovimientoCaja");
  const { consumirVentaEnCaja } = require("../../core/eventos/cajaVenta.consumer");
  await mongoose.connect(process.env.TEST_MONGO_URI, { dbName: "gruk_caja_rollback_test" });
  const empresaId = new mongoose.Types.ObjectId();
  const ventaId = new mongoose.Types.ObjectId();
  try {
    await Promise.all([Outbox.init(), Receipt.init(), Movimiento.init()]);
    const event = await Outbox.create({
      empresaId, aggregateId: ventaId, eventName: "VENTA_COMPLETADA",
      payload: { empresaId, ventaId, total: 0, metodoPago: "", fecha: new Date() }
    });
    await assert.rejects(
      consumirVentaEnCaja({ eventId: event._id, empresaId }),
      /CAJA_VENTA_EVENTO_SIN_MOVIMIENTO/
    );
    assert.equal(await Movimiento.countDocuments({ empresaId, origenId: ventaId }), 0);
    assert.equal(await Receipt.countDocuments({ empresaId, eventId: event._id }), 0);
  } finally {
    await mongoose.disconnect();
  }
});

test("Caja movement rolls back when processed receipt insert fails", {
  skip: !process.env.TEST_MONGO_URI
}, async () => {
  const mongoose = require("mongoose");
  const Outbox = require("../../models/GrukOutboxEvent");
  const Receipt = require("../../models/GrukEventoProcesado");
  const Movimiento = require("../../core/finanzas/models/MovimientoCaja");
  const { consumirVentaEnCaja } = require("../../core/eventos/cajaVenta.consumer");
  await mongoose.connect(process.env.TEST_MONGO_URI, { dbName: "gruk_caja_atomic_rollback_test" });
  const empresaId = new mongoose.Types.ObjectId();
  const ventaId = new mongoose.Types.ObjectId();
  try {
    await Promise.all([Outbox.init(), Receipt.init(), Movimiento.init()]);
    const event = await Outbox.create({
      empresaId, aggregateId: ventaId, eventName: "VENTA_COMPLETADA",
      payload: { empresaId, ventaId, total: 12000, metodoPago: "",
        fecha: new Date(), sourceUpdatedAt: new Date() }
    });
    const originalCreate = Receipt.create;
    Receipt.create = async () => { throw new Error("TEST_RECEIPT_WRITE_FAILURE"); };
    try {
      await assert.rejects(
        consumirVentaEnCaja({ eventId: event._id, empresaId }),
        /TEST_RECEIPT_WRITE_FAILURE/
      );
    } finally {
      Receipt.create = originalCreate;
    }
    assert.equal(await Movimiento.countDocuments({ empresaId, origenId: ventaId }), 0);
    assert.equal(await Receipt.countDocuments({ empresaId, eventId: event._id }), 0);
  } finally {
    await mongoose.disconnect();
  }
});

test("Caja durable consumer rejects a cross-tenant event without financial effects", {
  skip: !process.env.TEST_MONGO_URI
}, async () => {
  const mongoose = require("mongoose");
  const Outbox = require("../../models/GrukOutboxEvent");
  const Receipt = require("../../models/GrukEventoProcesado");
  const Movimiento = require("../../core/finanzas/models/MovimientoCaja");
  const { consumirVentaEnCaja } = require("../../core/eventos/cajaVenta.consumer");
  await mongoose.connect(process.env.TEST_MONGO_URI, { dbName: "gruk_caja_tenant_test" });
  const empresaId = new mongoose.Types.ObjectId();
  const otraEmpresaId = new mongoose.Types.ObjectId();
  const ventaId = new mongoose.Types.ObjectId();
  try {
    await Promise.all([Outbox.init(), Receipt.init(), Movimiento.init()]);
    const event = await Outbox.create({
      empresaId, aggregateId: ventaId, eventName: "VENTA_COMPLETADA",
      payload: { empresaId, ventaId, total: 12000, metodoPago: "",
        fecha: new Date(), sourceUpdatedAt: new Date() }
    });
    await assert.rejects(
      consumirVentaEnCaja({ eventId: event._id, empresaId: otraEmpresaId }),
      /CONSUMIDOR_EVENTO_NO_ENCONTRADO/
    );
    assert.equal(await Movimiento.countDocuments({ origenId: ventaId }), 0);
    assert.equal(await Receipt.countDocuments({ eventId: event._id }), 0);
  } finally {
    await mongoose.disconnect();
  }
});

test("Concurrent deliveries never persist two Caja movements or receipts", {
  skip: !process.env.TEST_MONGO_URI
}, async () => {
  const mongoose = require("mongoose");
  const Outbox = require("../../models/GrukOutboxEvent");
  const Receipt = require("../../models/GrukEventoProcesado");
  const Movimiento = require("../../core/finanzas/models/MovimientoCaja");
  const { consumirVentaEnCaja } = require("../../core/eventos/cajaVenta.consumer");
  await mongoose.connect(process.env.TEST_MONGO_URI, { dbName: "gruk_caja_concurrent_test" });
  const empresaId = new mongoose.Types.ObjectId();
  const ventaId = new mongoose.Types.ObjectId();
  try {
    await Promise.all([Outbox.init(), Receipt.init(), Movimiento.init()]);
    const event = await Outbox.create({
      empresaId, aggregateId: ventaId, eventName: "VENTA_COMPLETADA",
      payload: { empresaId, ventaId, total: 12000, metodoPago: "",
        fecha: new Date(), sourceUpdatedAt: new Date() }
    });
    const results = await Promise.allSettled(Array.from({ length: 5 },
      () => consumirVentaEnCaja({ eventId: event._id, empresaId })));
    assert.ok(results.some(result => result.status === "fulfilled"));
    assert.equal(await Movimiento.countDocuments({ empresaId, origenId: ventaId }), 1);
    assert.equal(await Receipt.countDocuments({ empresaId, eventId: event._id,
      consumidor: "CAJA_VENTA_V1" }), 1);
    const retry = await consumirVentaEnCaja({ eventId: event._id, empresaId });
    assert.equal(retry.duplicado, true);
  } finally {
    await mongoose.disconnect();
  }
});
