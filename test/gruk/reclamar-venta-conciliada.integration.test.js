"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

test("financial claim commits once and rolls back atomically against replica set", {
  skip: !process.env.CI && !process.env.TEST_MONGO_URI
}, async () => {
  if (!process.env.TEST_MONGO_URI) throw new Error("ORDEN_FINANCIERA_REQUIERE_MONGO");
  const mongoose = require("mongoose");
  const Venta = require("../../models/Venta");
  const Caja = require("../../core/finanzas/models/MovimientoCaja");
  const Ledger = require("../../core/finanzas/models/GrukLedgerV1");
  const { reclamarVentaConciliada } = require("../../core/finanzas/services/reclamarVentaConciliada.service");
  await mongoose.connect(process.env.TEST_MONGO_URI, { dbName: "gruk_financial_claim_integration_test" });
  try {
    await Promise.all([Venta.init(), Caja.init(), Ledger.init()]);
    const empresaId = new mongoose.Types.ObjectId();
    const sedeId = new mongoose.Types.ObjectId();
    const origenId = new mongoose.Types.ObjectId();
    const actorId = new mongoose.Types.ObjectId();
    const [venta] = await Venta.create([{
      empresaId, sedeId, origen: "restaurante", origenId,
      productoServicioId: new mongoose.Types.ObjectId(),
      cantidad: 1, precioUnitario: 52000, total: 52000,
      concepto: "Reclamacion financiera ACID", metodoPago: "efectivo"
    }]);
    await Caja.create([{
      empresaId, sedeId, direccion: "ENTRADA", monto: 52000, moneda: "COP",
      origenTipo: "VENTA", origenId: venta._id, tipoAsiento: "CONFIRMACION",
      claveIdempotencia: "claim:caja:" + String(venta._id),
      metodoPago: "efectivo", confirmadoAt: new Date()
    }]);
    await Ledger.create([{
      empresaId, sedeId, cuenta: "CAJA_EFECTIVO", secuencia: 1,
      tipo: "ABONO", moneda: "COP", montoMenor: "5200000",
      saldoAntesMenor: "0", saldoDespuesMenor: "5200000",
      actorId, ip: "127.0.0.1", hashAnterior: "0".repeat(64),
      hash: "1".repeat(64), claveIdempotencia: "venta:" + String(origenId)
    }]);
    const ids = { empresaId, sedeId, ventaId: venta._id };
    const token = "orden:claim:rollback:123456";
    const session = await mongoose.startSession();
    try {
      await assert.rejects(session.withTransaction(async () => {
        await reclamarVentaConciliada({ ...ids, token, session });
        throw new Error("FALLO_SIMULADO");
      }), { message: "FALLO_SIMULADO" });
      assert.equal((await Venta.collection.findOne({ _id: venta._id })).grukControlFinanciero, undefined);
      const firstRace = await Promise.allSettled([
        (async () => {
          const s = await mongoose.startSession();
          try {
            return await s.withTransaction(async () =>
              reclamarVentaConciliada({
                ...ids, token: "orden:claim:first:a123456", session: s
              }));
          } finally {
            await s.endSession();
          }
        })(),
        (async () => {
          const s = await mongoose.startSession();
          try {
            return await s.withTransaction(async () =>
              reclamarVentaConciliada({
                ...ids, token: "orden:claim:first:b123456", session: s
              }));
          } finally {
            await s.endSession();
          }
        })()
      ]);
      assert.equal(firstRace.filter(x => x.status === "fulfilled").length, 1);
      const winner = (await Venta.collection.findOne({ _id: venta._id }))
        .grukControlFinanciero.token;
      assert.ok([
        "orden:claim:first:a123456", "orden:claim:first:b123456"
      ].includes(winner));
      // Reset the isolated fixture so the existing sequential commit test
      // can still validate the post-rollback claim independently.
      await Venta.collection.updateOne({ _id: venta._id }, {
        $unset: { grukControlFinanciero: "" }
      });
      await session.withTransaction(async () => {
        const result = await reclamarVentaConciliada({ ...ids, token, session });
        assert.equal(result.conciliada, true);
      });
      assert.equal((await Venta.collection.findOne({ _id: venta._id })).grukControlFinanciero.token, token);
      const competing = await Promise.allSettled([
        (async () => {
          const s = await mongoose.startSession();
          try {
            return await s.withTransaction(async () =>
              reclamarVentaConciliada({ ...ids, token: "orden:claim:parallel:a123", session: s }));
          } finally {
            await s.endSession();
          }
        })(),
        (async () => {
          const s = await mongoose.startSession();
          try {
            return await s.withTransaction(async () =>
              reclamarVentaConciliada({ ...ids, token: "orden:claim:parallel:b123", session: s }));
          } finally {
            await s.endSession();
          }
        })()
      ]);
      assert.equal(competing.filter(x => x.status === "fulfilled").length, 0);
      assert.equal((await Venta.collection.findOne({ _id: venta._id })).grukControlFinanciero.token, token);
      await assert.rejects(session.withTransaction(async () => {
        await reclamarVentaConciliada({ ...ids, token: "orden:claim:replay:123456", session });
      }), { message: "ORDEN_FINANCIERA_CONFLICTO_CONCURRENCIA" });
      assert.equal((await Venta.collection.findOne({ _id: venta._id })).grukControlFinanciero.token, token);
    } finally {
      await session.endSession();
    }
  } finally {
    await mongoose.disconnect();
  }
});
