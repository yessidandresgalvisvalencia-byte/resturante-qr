"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const MovimientoCaja = require("../../core/finanzas/models/MovimientoCaja");
const CuentaTesoreria = require("../../core/finanzas/models/CuentaTesoreria");
const { calcularSaldoCuenta, transferir, obtenerResumenTesoreria } = require("../../core/finanzas/tesoreria.service");
const { cents } = require("../../core/finanzas/dineroExacto");

const EMPRESA = new mongoose.Types.ObjectId();
const SEDE = new mongoose.Types.ObjectId();
const CUENTA = new mongoose.Types.ObjectId();

test("P0-04 treasury: Decimal128 movements preserve exact cents in available balance", async () => {
  const old = MovimientoCaja.aggregate;
  let pipeline;
  MovimientoCaja.aggregate = async p => {
    pipeline = p;
    return [{
      entradas: mongoose.Types.Decimal128.fromString("0.30"),
      salidas: mongoose.Types.Decimal128.fromString("0.20")
    }];
  };
  try {
    const saldo = await calcularSaldoCuenta({
      _id: CUENTA, empresaId: EMPRESA, sedeId: SEDE,
      saldoInicial: "0.10", saldoInicialAt: new Date("2026-01-01")
    });
    assert.equal(cents(saldo.saldoDisponible), 20n);
    assert.equal(cents(saldo.entradas), 30n);
    assert.equal(cents(saldo.salidas), 20n);
    assert.equal(cents(saldo.saldoInicial), 10n);
    const group = pipeline.at(-1).$group;
    assert.deepEqual(group.entradas.$sum.$cond[1], { $toDecimal: "$monto" });
    assert.deepEqual(group.salidas.$sum.$cond[1], { $toDecimal: "$monto" });
    assert.equal(String(pipeline[0].$match.empresaId), String(EMPRESA));
    assert.equal(String(pipeline[0].$match.cuentaTesoreriaId), String(CUENTA));
  } finally {
    MovimientoCaja.aggregate = old;
  }
});

test("P0-04 treasury: refuse legacy sub-cent rows, no false reconciled balance", async () => {
  const old = MovimientoCaja.aggregate;
  MovimientoCaja.aggregate = async () => [{
    entradas: mongoose.Types.Decimal128.fromString("0.301"),
    salidas: mongoose.Types.Decimal128.fromString("0")
  }];
  try {
    await assert.rejects(calcularSaldoCuenta({
      _id: CUENTA, empresaId: EMPRESA, saldoInicial: 0, saldoInicialAt: new Date()
    }), /DINERO_PRECISION_entradasTesoreria/);
  } finally {
    MovimientoCaja.aggregate = old;
  }
});

test("P0-04 treasury: transfer refuses sub-cent and invalid amounts before any DB transaction", async () => {
  for (const invalid of ["0.001", "0", "-1", "90071992547409.92", null]) {
    await assert.rejects(transferir({
      empresaId: EMPRESA, cuentaOrigenId: new mongoose.Types.ObjectId(),
      cuentaDestinoId: new mongoose.Types.ObjectId(), monto: invalid, createdBy: CUENTA
    }), e => e.statusCode === 400 && /Monto de transferencia invalido/.test(e.message));
  }
});

test("P0-04 treasury: combined account summary adds centavos without floating errors", async () => {
  const oldAggregate = MovimientoCaja.aggregate;
  const oldFind = CuentaTesoreria.find;
  const cuenta1 = new mongoose.Types.ObjectId();
  const cuenta2 = new mongoose.Types.ObjectId();
  const comienzo = new Date("2026-01-01T00:00:00.000Z");
  CuentaTesoreria.find = () => ({
    sort() { return this; },
    async lean() {
      return [
        { _id: cuenta1, empresaId: EMPRESA, saldoInicial: 0.1, saldoInicialAt: comienzo },
        { _id: cuenta2, empresaId: EMPRESA, saldoInicial: 0.2, saldoInicialAt: comienzo }
      ];
    }
  });
  MovimientoCaja.aggregate = async p => {
    if (p[0].$match?.cuentaTesoreriaId) {
      return [{
        entradas: mongoose.Types.Decimal128.fromString("0"),
        salidas: mongoose.Types.Decimal128.fromString("0")
      }];
    }
    return [];
  };
  try {
    const summary = await obtenerResumenTesoreria({ empresaId: EMPRESA, sedeId: SEDE });
    assert.equal(summary.estadoConfiabilidad, "COMPLETO");
    assert.equal(summary.cuentas.length, 2);
    assert.equal(summary.saldoDisponible, 0.3);
    assert.equal(cents(summary.saldoDisponible), 30n);
    assert.equal(summary.movimientosSinAsignar.entradas.monto, 0);
  } finally {
    CuentaTesoreria.find = oldFind;
    MovimientoCaja.aggregate = oldAggregate;
  }
});
