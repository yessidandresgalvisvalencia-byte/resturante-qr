"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

test("consumer registration cannot succeed after global closure under contention", {
  skip: !process.env.TEST_MONGO_URI
}, async () => {
  const mongoose = require("mongoose");
  const Outbox = require("../../models/GrukOutboxEvent");
  const Entrega = require("../../models/GrukEntregaConsumidor");
  const { registrarConsumidorAdicional } = require("../../core/eventos/registrarConsumidorAdicional.service");
  const { cerrarVentaEntregada } = require("../../core/eventos/cerrarVentaEntregada.service");
  await mongoose.connect(process.env.TEST_MONGO_URI, { dbName: "gruk_outbox_close_register_race_test" });
  try {
    await Promise.all([Outbox.init(), Entrega.init()]);
    const empresaId = new mongoose.Types.ObjectId();
    const ventaId = new mongoose.Types.ObjectId();
    const event = await Outbox.create({
      empresaId, aggregateId: ventaId, eventName: "VENTA_COMPLETADA",
      payload: { empresaId, ventaId }
    });
    await Entrega.create([
      { empresaId, eventId: event._id, consumidor: "CAJA_VENTA_V1", estado: "ENTREGADO" },
      { empresaId, eventId: event._id, consumidor: "FACTURACION_VENTA_V1", estado: "ENTREGADO" }
    ], { ordered: true });
    const [register, close] = await Promise.allSettled([
      registrarConsumidorAdicional({ empresaId, eventId: event._id, consumidor: "AUDITORIA_VENTA_V1" }),
      cerrarVentaEntregada({ empresaId, eventId: event._id })
    ]);
    const state = await Outbox.findById(event._id).lean();
    const additional = await Entrega.findOne({
      empresaId, eventId: event._id, consumidor: "AUDITORIA_VENTA_V1"
    }).lean();
    assert.ok(["PENDIENTE", "ENTREGADO"].includes(state.estado));
    if (state.estado === "ENTREGADO") {
      assert.equal(additional, null, "a globally delivered event cannot acquire a pending obligation");
    }
    if (additional) {
      assert.equal(state.estado, "PENDIENTE", "registered obligation must block closure");
      assert.equal(additional.estado, "PENDIENTE");
    }
    assert.ok(register.status === "fulfilled" || close.status === "fulfilled");
  } finally {
    await mongoose.disconnect();
  }
});


test("consumer claim and global closure cannot leave a delivered event with an active lease", {
  skip: !process.env.TEST_MONGO_URI
}, async () => {
  const mongoose = require("mongoose");
  const Outbox = require("../../models/GrukOutboxEvent");
  const Entrega = require("../../models/GrukEntregaConsumidor");
  const { reclamarEntrega } = require("../../core/eventos/entregaConsumidor.service");
  const { cerrarVentaEntregada } = require("../../core/eventos/cerrarVentaEntregada.service");
  await mongoose.connect(process.env.TEST_MONGO_URI, { dbName: "gruk_outbox_claim_close_race_test" });
  try {
    await Promise.all([Outbox.init(), Entrega.init()]);
    const empresaId = new mongoose.Types.ObjectId();
    const ventaId = new mongoose.Types.ObjectId();
    const event = await Outbox.create({
      empresaId, aggregateId: ventaId, eventName: "VENTA_COMPLETADA",
      payload: { empresaId, ventaId }
    });
    await Entrega.create([
      { empresaId, eventId: event._id, consumidor: "CAJA_VENTA_V1", estado: "ENTREGADO" },
      { empresaId, eventId: event._id, consumidor: "FACTURACION_VENTA_V1", estado: "PENDIENTE" }
    ], { ordered: true });
    const [claim, close] = await Promise.allSettled([
      reclamarEntrega({ empresaId, eventId: event._id, consumidor: "FACTURACION_VENTA_V1" }),
      cerrarVentaEntregada({ empresaId, eventId: event._id })
    ]);
    const parent = await Outbox.findById(event._id).lean();
    const delivery = await Entrega.findOne({ empresaId, eventId: event._id,
      consumidor: "FACTURACION_VENTA_V1" }).lean();
    assert.equal(parent.estado, "PENDIENTE");
    assert.ok(["PENDIENTE", "PROCESANDO"].includes(delivery.estado));
    if (claim.status === "fulfilled" && claim.value.reclamada) {
      assert.equal(delivery.estado, "PROCESANDO");
      assert.equal(delivery.leaseToken, claim.value.leaseToken);
    }
    if (close.status === "fulfilled") assert.equal(close.value.cerrado, false);
  } finally {
    await mongoose.disconnect();
  }
});


test("consumer claim and additional registration preserve both obligations under contention", {
  skip: !process.env.TEST_MONGO_URI
}, async () => {
  const mongoose = require("mongoose");
  const Outbox = require("../../models/GrukOutboxEvent");
  const Entrega = require("../../models/GrukEntregaConsumidor");
  const { reclamarEntrega } = require("../../core/eventos/entregaConsumidor.service");
  const { registrarConsumidorAdicional } = require("../../core/eventos/registrarConsumidorAdicional.service");
  await mongoose.connect(process.env.TEST_MONGO_URI, { dbName: "gruk_outbox_claim_register_race_test" });
  try {
    await Promise.all([Outbox.init(), Entrega.init()]);
    const empresaId = new mongoose.Types.ObjectId();
    const ventaId = new mongoose.Types.ObjectId();
    const event = await Outbox.create({
      empresaId, aggregateId: ventaId, eventName: "VENTA_COMPLETADA",
      payload: { empresaId, ventaId }
    });
    await Entrega.create([
      { empresaId, eventId: event._id, consumidor: "CAJA_VENTA_V1" },
      { empresaId, eventId: event._id, consumidor: "FACTURACION_VENTA_V1" }
    ], { ordered: true });
    const [claim, registration] = await Promise.allSettled([
      reclamarEntrega({ empresaId, eventId: event._id, consumidor: "CAJA_VENTA_V1" }),
      registrarConsumidorAdicional({ empresaId, eventId: event._id, consumidor: "AUDITORIA_VENTA_V1" })
    ]);
    const parent = await Outbox.findById(event._id).lean();
    const caja = await Entrega.findOne({ empresaId, eventId: event._id,
      consumidor: "CAJA_VENTA_V1" }).lean();
    const audit = await Entrega.findOne({ empresaId, eventId: event._id,
      consumidor: "AUDITORIA_VENTA_V1" }).lean();
    assert.equal(parent.estado, "PENDIENTE");
    assert.ok(["PENDIENTE", "PROCESANDO"].includes(caja.estado));
    assert.ok(claim.status === "fulfilled" || registration.status === "fulfilled");
    if (claim.status === "fulfilled" && claim.value.reclamada) {
      assert.equal(caja.estado, "PROCESANDO");
      assert.equal(caja.leaseToken, claim.value.leaseToken);
    }
    if (registration.status === "fulfilled" && registration.value.registrada) {
      assert.equal(audit.estado, "PENDIENTE");
    }
    const committed = Number(caja.estado === "PROCESANDO") + Number(Boolean(audit));
    assert.equal(parent.registroVersion, committed);
  } finally {
    await mongoose.disconnect();
  }
});
