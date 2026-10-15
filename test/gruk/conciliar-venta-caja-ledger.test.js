"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const Venta = require("../../models/Venta");
const Caja = require("../../core/finanzas/models/MovimientoCaja");
const Ledger = require("../../core/finanzas/models/GrukLedgerV1");
const { conciliarVentaCajaLedger } = require("../../core/finanzas/services/conciliarVentaCajaLedger.service");

test("reconciliation rejects invalid tenant and sale identifiers", async () => {
  await assert.rejects(conciliarVentaCajaLedger({
    empresaId: "invalid", sedeId: "invalid", ventaId: "invalid"
  }), /CONCILIACION_IDENTIDAD_INVALIDA/);
});

test("reconciliation reports missing sale without modifying balances", async () => {
  const original = Venta.findOne;
  Venta.findOne = () => ({ lean: async () => null });
  try {
    const result = await conciliarVentaCajaLedger({
      empresaId: new mongoose.Types.ObjectId(),
      sedeId: new mongoose.Types.ObjectId(),
      ventaId: new mongoose.Types.ObjectId()
    });
    assert.deepEqual(result, { conciliada: false, estado: "VENTA_NO_ENCONTRADA" });
  } finally { Venta.findOne = original; }
});

test("reconciliation detects duplicate Caja records", async () => {
  const originals = [Venta.findOne, Caja.find, Ledger.find];
  const empresaId = new mongoose.Types.ObjectId();
  const sedeId = new mongoose.Types.ObjectId();
  const ventaId = new mongoose.Types.ObjectId();
  const origenId = new mongoose.Types.ObjectId();
  Venta.findOne = () => ({ lean: async () => ({ origenId, total: 52000 }) });
  Caja.find = () => ({ lean: async () => [{}, {}] });
  Ledger.find = () => ({ lean: async () => [{}] });
  try {
    const result = await conciliarVentaCajaLedger({ empresaId, sedeId, ventaId });
    assert.equal(result.estado, "REGISTROS_INCOMPLETOS_O_DUPLICADOS");
    assert.equal(result.conciliada, false);
    assert.equal(result.movimientosCaja, 2);
  } finally {
    [Venta.findOne, Caja.find, Ledger.find] = originals;
  }
});

test("reconciliation accepts exactly matching Caja and ledger amounts", async () => {
  const originals = [Venta.findOne, Caja.find, Ledger.find];
  const empresaId = new mongoose.Types.ObjectId();
  const sedeId = new mongoose.Types.ObjectId();
  const ventaId = new mongoose.Types.ObjectId();
  const origenId = new mongoose.Types.ObjectId();
  Venta.findOne = () => ({ lean: async () => ({ origenId, total: 52000 }) });
  Caja.find = () => ({ lean: async () => [{
    monto: 52000, direccion: "ENTRADA", moneda: "COP"
  }] });
  Ledger.find = () => ({ lean: async () => [{
    montoMenor: "5200000", tipo: "ABONO", moneda: "COP"
  }] });
  try {
    const result = await conciliarVentaCajaLedger({ empresaId, sedeId, ventaId });
    assert.equal(result.estado, "CONCILIADA");
    assert.equal(result.conciliada, true);
  } finally {
    [Venta.findOne, Caja.find, Ledger.find] = originals;
  }
});

test("reconciliation fails closed on amount mismatch", async () => {
  const originals = [Venta.findOne, Caja.find, Ledger.find];
  const empresaId = new mongoose.Types.ObjectId();
  const sedeId = new mongoose.Types.ObjectId();
  const ventaId = new mongoose.Types.ObjectId();
  const origenId = new mongoose.Types.ObjectId();
  Venta.findOne = () => ({ lean: async () => ({ origenId, total: 52000 }) });
  Caja.find = () => ({ lean: async () => [{
    monto: 52000, direccion: "ENTRADA", moneda: "COP"
  }] });
  Ledger.find = () => ({ lean: async () => [{
    montoMenor: "5300000", tipo: "ABONO", moneda: "COP"
  }] });
  try {
    const result = await conciliarVentaCajaLedger({ empresaId, sedeId, ventaId });
    assert.equal(result.estado, "DIFERENCIA");
    assert.equal(result.conciliada, false);
  } finally {
    [Venta.findOne, Caja.find, Ledger.find] = originals;
  }
});
