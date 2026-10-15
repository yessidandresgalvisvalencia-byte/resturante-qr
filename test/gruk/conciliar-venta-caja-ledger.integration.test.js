"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

test("reconciliation reads real MongoDB records and rejects a reversal", {
  skip: !process.env.CI && !process.env.TEST_MONGO_URI
}, async () => {
  if (!process.env.TEST_MONGO_URI) throw new Error("CONCILIACION_REQUIERE_MONGO");
  const mongoose = require("mongoose");
  const Venta = require("../../models/Venta");
  const Caja = require("../../core/finanzas/models/MovimientoCaja");
  const Ledger = require("../../core/finanzas/models/GrukLedgerV1");
  const { conciliarVentaCajaLedger, conciliarVentaCajaLedgerSnapshot } = require("../../core/finanzas/services/conciliarVentaCajaLedger.service");
  await mongoose.connect(process.env.TEST_MONGO_URI, { dbName: "gruk_reconciliation_integration_test" });
  try {
    const empresaId = new mongoose.Types.ObjectId();
    const sedeId = new mongoose.Types.ObjectId();
    const origenId = new mongoose.Types.ObjectId();
    const actorId = new mongoose.Types.ObjectId();
    const [venta] = await Venta.create([{
      empresaId, sedeId, origen: "restaurante", origenId,
      productoServicioId: new mongoose.Types.ObjectId(),
      cantidad: 1, precioUnitario: 52000, total: 52000,
      concepto: "Venta conciliacion ACID",
      costoUnitario: 25000, costoTotal: 25000, utilidadBruta: 27000,
      margenBruto: 51.92, metodoPago: "efectivo"
    }]);
    const [movimiento] = await Caja.create([{
      empresaId, sedeId, direccion: "ENTRADA", monto: 52000, moneda: "COP",
      origenTipo: "VENTA", origenId: venta._id, tipoAsiento: "CONFIRMACION",
      claveIdempotencia: "ci:venta:" + String(venta._id),
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
    assert.equal((await conciliarVentaCajaLedger(ids)).estado, "CONCILIADA");
    assert.deepEqual(await conciliarVentaCajaLedgerSnapshot(ids), {
      conciliada: true, estado: "CONCILIADA",
      movimientosCaja: 1, asientosLedger: 1, consistencia: "SNAPSHOT"
    });
    await Venta.updateOne({ _id: venta._id }, { $set: { estado: "anulada" } });
    assert.equal((await conciliarVentaCajaLedger(ids)).estado, "VENTA_NO_PAGADA");
    await Venta.updateOne({ _id: venta._id }, { $set: { estado: "pendiente" } });
    assert.equal((await conciliarVentaCajaLedger(ids)).estado, "VENTA_NO_PAGADA");
    await Venta.updateOne({ _id: venta._id }, { $set: { estado: "pagada" } });
    assert.equal((await conciliarVentaCajaLedger(ids)).estado, "CONCILIADA");
    await Ledger.collection.updateOne(
      { empresaId, sedeId, claveIdempotencia: "venta:" + String(origenId) },
      { $set: { cuenta: "PAGOS_TARJETA_POR_CONCILIAR" } }
    );
    assert.equal((await conciliarVentaCajaLedger(ids)).estado, "CUENTA_LEDGER_INCONSISTENTE");
    await Ledger.collection.updateOne(
      { empresaId, sedeId, claveIdempotencia: "venta:" + String(origenId) },
      { $set: { cuenta: "CAJA_EFECTIVO" } }
    );
    assert.equal((await conciliarVentaCajaLedger(ids)).estado, "CONCILIADA");
    await Caja.collection.updateOne(
      { _id: movimiento._id },
      { $set: { metodoPago: "tarjeta" } }
    );
    assert.equal((await conciliarVentaCajaLedger(ids)).estado, "MEDIO_PAGO_INCONSISTENTE");
    await Caja.collection.updateOne(
      { _id: movimiento._id },
      { $set: { metodoPago: "efectivo" } }
    );
    assert.equal((await conciliarVentaCajaLedger(ids)).estado, "CONCILIADA");
    assert.equal((await conciliarVentaCajaLedger({
      ...ids, empresaId: new mongoose.Types.ObjectId()
    })).estado, "VENTA_NO_ENCONTRADA");
    assert.equal((await conciliarVentaCajaLedger({
      ...ids, sedeId: new mongoose.Types.ObjectId()
    })).estado, "VENTA_NO_ENCONTRADA");
    const snapshotSession = await mongoose.startSession();
    try {
      snapshotSession.startTransaction({
        readConcern: { level: "snapshot" }, readPreference: "primary"
      });
      try {
        const inicial = await conciliarVentaCajaLedger({ ...ids, session: snapshotSession });
        assert.equal(inicial.estado, "CONCILIADA");
        assert.equal((await conciliarVentaCajaLedger(ids)).estado, "VENTA_REVERSADA");
    assert.equal((await conciliarVentaCajaLedgerSnapshot(ids)).estado, "VENTA_REVERSADA");
    assert.equal(await Caja.countDocuments({
      empresaId, sedeId, origenTipo: "VENTA", origenId: venta._id,
      tipoAsiento: "CONFIRMACION"
    }), 1);
    assert.equal(await Caja.countDocuments({
      empresaId, sedeId, origenTipo: "VENTA", origenId: venta._id,
      tipoAsiento: "REVERSION"
    }), 1);
    assert.equal(await Ledger.countDocuments({
      empresaId, sedeId, claveIdempotencia: "venta:" + String(origenId)
    }), 1);
  } finally {
    await mongoose.disconnect();
  }
});
