"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

test("ledger preserves atomicity, chain, tenant isolation and idempotency", {
  skip: !process.env.TEST_MONGO_URI
}, async () => {
  const mongoose = require("mongoose");
  const Ledger = require("../../core/finanzas/models/GrukLedgerV1");
  const { verificarCadena } = require("../../core/finanzas/services/verificarCadenaLedger.service");
  const { GENESIS, hashMovimiento, registrarMovimiento } =
    require("../../core/finanzas/services/ledgerAppend.service");
  await mongoose.connect(process.env.TEST_MONGO_URI, {
    dbName: "gruk_ledger_append_integration_test"
  });
  const empresaId = new mongoose.Types.ObjectId();
  const otraEmpresaId = new mongoose.Types.ObjectId();
  const sedeId = new mongoose.Types.ObjectId();
  const actorId = new mongoose.Types.ObjectId();
  const base = {
    empresaId, sedeId, actorId, cuenta: "CAJA_PRUEBA", tipo: "ABONO",
    montoMenor: "5200000", ip: "127.0.0.1",
    claveIdempotencia: "ledger-test-transaction-001"
  };
  try {
    await Ledger.init();
    const session = await mongoose.startSession();
    try {
      await assert.rejects(session.withTransaction(async () => {
        const created = await registrarMovimiento(base, { session });
        assert.equal(created.creado, true);
        throw new Error("FORCED_ROLLBACK");
      }), /FORCED_ROLLBACK/);
      assert.equal(await Ledger.countDocuments({ empresaId, sedeId }), 0);
      await session.withTransaction(async () => {
        const first = await registrarMovimiento(base, { session });
        assert.equal(first.creado, true);
        assert.equal(first.movimiento.hashAnterior, GENESIS);
        assert.equal(first.movimiento.saldoDespuesMenor, "5200000");
        const replay = await registrarMovimiento(base, { session });
        assert.equal(replay.creado, false);
        await assert.rejects(
          registrarMovimiento({ ...base, montoMenor: "5200001" }, { session }),
          /LEDGER_IDEMPOTENCIA_CONFLICTO/
        );
        const second = await registrarMovimiento({
          ...base, tipo: "CARGO", montoMenor: "100",
          claveIdempotencia: "ledger-test-transaction-002"
        }, { session });
        assert.equal(second.movimiento.saldoAntesMenor, "5200000");
        assert.equal(second.movimiento.saldoDespuesMenor, "5199900");
        assert.equal(second.movimiento.hashAnterior, first.movimiento.hash);
      });
      await session.withTransaction(async () => {
        const other = await registrarMovimiento({
          ...base, empresaId: otraEmpresaId
        }, { session });
        assert.equal(other.movimiento.secuencia, 1);
        assert.equal(other.movimiento.hashAnterior, GENESIS);
      });
    } finally {
      await session.endSession();
    }
    const rows = await Ledger.find({ empresaId, sedeId }).sort({ secuencia: 1 }).lean();
    assert.equal(rows.length, 2);
    assert.deepEqual(await verificarCadena({ empresaId, sedeId, cuenta: "CAJA_PRUEBA" }), {
      integra: true, movimientos: 2, saldoMenor: "5199900", hashFinal: rows[1].hash
    });
    for (const row of rows) assert.equal(row.hash, hashMovimiento(row));
    assert.equal(await Ledger.countDocuments({ empresaId: otraEmpresaId, sedeId }), 1);
    const tampered = { ...rows[1], montoMenor: "100.5" };
    assert.notEqual(hashMovimiento(tampered), rows[1].hash);
    await assert.rejects(Ledger.updateOne({ _id: rows[0]._id }, {
      $set: { montoMenor: "1" }
    }), /GRUK_LEDGER_APPEND_ONLY/);
  } finally {
    await mongoose.disconnect();
  }
});
