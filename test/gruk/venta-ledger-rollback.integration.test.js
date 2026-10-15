"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

test("sale-ledger integration rolls back sale, outbox and ledger together", {
  skip: !process.env.CI && !process.env.TEST_MONGO_URI
}, async () => {
  if (!process.env.TEST_MONGO_URI) throw new Error("GRUK_CI_REQUIERE_MONGO_TRANSACCIONAL");
  const mongoose = require("mongoose");
  const Venta = require("../../models/Venta");
  const ProductoServicio = require("../../models/ProductoServicio");
  const Ledger = require("../../core/finanzas/models/GrukLedgerV1");
  const Outbox = require("../../models/GrukOutboxEvent");
  const { registrarVentaConLedger } = require("../../core/finanzas/services/ventaConLedger.service");
  await mongoose.connect(process.env.TEST_MONGO_URI, { dbName: "gruk_sale_ledger_rollback_test" });
  const empresaId = new mongoose.Types.ObjectId();
  const sedeId = new mongoose.Types.ObjectId();
  const actorId = new mongoose.Types.ObjectId();
  const pedidoId = new mongoose.Types.ObjectId();
  try {
    await Promise.all([Venta.init(), Ledger.init(), Outbox.init()]);
    const [producto] = await ProductoServicio.create([{
      empresaId, sedeId, tipo: "producto", nombre: "Prueba ACID",
      precioVenta: 52000, costoUnitario: 25000
    }]);
    const pedido = {
      _id: pedidoId, productoServicioId: producto._id, producto: "Prueba ACID",
      cantidad: 1, precioUnitario: 52000, precio: "52000",
      restaurantId: "ci", mesa: "1", metodoPago: "efectivo"
    };
    const input = {
      pedido, empresaId, sedeId, actorId, ip: "127.0.0.1",
      claveIdempotencia: "venta:" + String(pedidoId)
    };
    const session = await mongoose.startSession();
    try {
      await assert.rejects(session.withTransaction(async () => {
        const result = await registrarVentaConLedger({ ...input, session });
        assert.equal(result.creada, true);
        throw new Error("ROLLBACK_DE_PRUEBA");
      }), /ROLLBACK_DE_PRUEBA/);
      assert.equal(await Venta.countDocuments({ empresaId, origenId: pedidoId }), 0);
      assert.equal(await Ledger.countDocuments({ empresaId, sedeId }), 0);
      assert.equal(await Outbox.countDocuments({ empresaId }), 0);
      await session.withTransaction(async () => {
        const result = await registrarVentaConLedger({ ...input, session });
        assert.equal(result.creada, true);
        assert.equal(result.movimiento.montoMenor, "5200000");
        assert.equal(result.movimiento.cuenta, "CAJA_EFECTIVO");
      });
      await session.withTransaction(async () => {
        const replay = await registrarVentaConLedger({ ...input, session });
        assert.equal(replay.creada, false);
      });
      assert.equal(await Venta.countDocuments({ empresaId, origenId: pedidoId }), 1);
      assert.equal(await Ledger.countDocuments({ empresaId, sedeId }), 1);
      assert.equal(await Outbox.countDocuments({ empresaId }), 1);
      await assert.rejects(session.withTransaction(async () => {
        await registrarVentaConLedger({
          ...input, pedido: { ...pedido, precio: "53000" }, session
        });
      }), /VENTA_LEDGER_REINTENTO_INCONSISTENTE/);
      assert.equal(await Venta.countDocuments({ empresaId, origenId: pedidoId }), 1);
      assert.equal(await Ledger.countDocuments({ empresaId, sedeId }), 1);
      await assert.rejects(session.withTransaction(async () => {
        await registrarVentaConLedger({
          ...input, pedido: { ...pedido, metodoPago: "tarjeta" }, session
        });
      }), /VENTA_LEDGER_REINTENTO_INCONSISTENTE/);
      assert.equal(await Ledger.countDocuments({ empresaId, sedeId }), 1);
      await assert.rejects(session.withTransaction(async () => {
        await registrarVentaConLedger({
          ...input, actorId: new mongoose.Types.ObjectId(), session
        });
      }), /VENTA_LEDGER_REINTENTO_INCONSISTENTE/);
      assert.equal(await Ledger.countDocuments({ empresaId, sedeId }), 1);
      await assert.rejects(session.withTransaction(async () => {
        await registrarVentaConLedger({ ...input, ip: "127.0.0.2", session });
      }), /VENTA_LEDGER_REINTENTO_INCONSISTENTE/);
      assert.equal(await Ledger.countDocuments({ empresaId, sedeId }), 1);
      const concurrentOrderId = new mongoose.Types.ObjectId();
      const concurrentInput = {
        ...input,
        pedido: { ...pedido, _id: concurrentOrderId },
        claveIdempotencia: "venta:" + String(concurrentOrderId)
      };
      const sessions = await Promise.all([
        mongoose.startSession(), mongoose.startSession()
      ]);
      try {
        const outcomes = await Promise.allSettled(sessions.map((activeSession) =>
          activeSession.withTransaction(() =>
            registrarVentaConLedger({ ...concurrentInput, session: activeSession })
          )
        ));
        const successful = outcomes.filter((outcome) => outcome.status === "fulfilled");
        assert.ok(successful.length >= 1, "At least one concurrent sale must commit");
        assert.equal(await Venta.countDocuments({
          empresaId, origenId: concurrentOrderId
        }), 1);
        assert.equal(await Ledger.countDocuments({
          empresaId, sedeId, claveIdempotencia: concurrentInput.claveIdempotencia
        }), 1);
        assert.equal(await Outbox.countDocuments({
          empresaId, "payload.origenId": String(concurrentOrderId)
        }) <= 1, true);
      } finally {
        await Promise.all(sessions.map((activeSession) => activeSession.endSession()));
      }
    } finally {
      await session.endSession();
    }
  } finally {
    await mongoose.disconnect();
  }
});
