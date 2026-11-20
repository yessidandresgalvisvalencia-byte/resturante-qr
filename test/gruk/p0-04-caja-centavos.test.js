"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const MovimientoCaja = require("../../core/finanzas/models/MovimientoCaja");
const { cents } = require("../../core/finanzas/dineroExacto");
const {
  construirCandidatoDesdeEvento,
  obtenerResumenCaja
} = require("../../core/finanzas/caja.service");

const EMPRESA = "aaaaaaaaaaaaaaaaaaaaaaaa";
const SEDE = "bbbbbbbbbbbbbbbbbbbbbbbb";
const DESDE = new Date("2026-01-01T00:00:00.000Z");
const HASTA = new Date("2026-02-01T00:00:00.000Z");

function saleEvent(monto) {
  return {
    eventName: "VENTA_COMPLETADA",
    occurredAt: DESDE,
    payload: {
      ventaId: "cccccccccccccccccccccccc",
      empresaId: EMPRESA,
      sedeId: SEDE,
      total: monto,
      sourceUpdatedAt: DESDE
    }
  };
}

test("P0-04 caja: rejects non-cent event amounts before creating an asiento", () => {
  assert.throws(() => construirCandidatoDesdeEvento(saleEvent("0.001")), /DINERO_PRECISION_montoCaja/);
  assert.throws(() => construirCandidatoDesdeEvento(saleEvent("90071992547409.92")), /DINERO_RANGO_montoCaja/);
  assert.equal(construirCandidatoDesdeEvento(saleEvent("0")), null);
  assert.equal(construirCandidatoDesdeEvento(saleEvent("-1")), null);
  assert.equal(construirCandidatoDesdeEvento(saleEvent("1.20")).monto, 1.2);
  assert.equal(cents(construirCandidatoDesdeEvento(saleEvent("1.20")).monto), 120n);
});

test("P0-04 caja: reports accumulate Decimal128 rows and compute net cash in integer centavos", async () => {
  const previous = MovimientoCaja.aggregate;
  let pipeline = null;
  MovimientoCaja.aggregate = async p => {
    pipeline = p;
    return [
      { _id: "VENTA", cantidad: 3, monto: mongoose.Types.Decimal128.fromString("0.60") },
      { _id: "COMPRA", cantidad: 2, monto: mongoose.Types.Decimal128.fromString("0.10") },
      { _id: "GASTO", cantidad: 1, monto: mongoose.Types.Decimal128.fromString("0.20") }
    ];
  };
  try {
    const report = await obtenerResumenCaja({
      empresaId: EMPRESA, sedeId: SEDE, desde: DESDE, hasta: HASTA
    });
    assert.equal(cents(report.entradasConfirmadas), 60n);
    assert.equal(cents(report.salidasConfirmadas), 30n);
    assert.equal(cents(report.flujoConfirmadoParcial), 30n);
    assert.deepEqual(report.ventasPagadas, { cantidad: 3, monto: 0.6 });
    assert.equal(String(pipeline[0].$match.empresaId), EMPRESA);
    assert.equal(String(pipeline[0].$match.sedeId), SEDE);
    assert.deepEqual(pipeline.at(-1).$group.monto, {
      $sum: { $toDecimal: "$monto" }
    });
  } finally {
    MovimientoCaja.aggregate = previous;
  }
});

test("P0-04 caja: legacy dirty numeric rows trigger explicit error instead of silent rounding", async () => {
  const previous = MovimientoCaja.aggregate;
  MovimientoCaja.aggregate = async () => [
    { _id: "VENTA", cantidad: 1, monto: mongoose.Types.Decimal128.fromString("0.301") }
  ];
  try {
    await assert.rejects(
      obtenerResumenCaja({ empresaId: EMPRESA, desde: DESDE, hasta: HASTA }),
      /DINERO_PRECISION_montoResumen/
    );
  } finally {
    MovimientoCaja.aggregate = previous;
  }
});
