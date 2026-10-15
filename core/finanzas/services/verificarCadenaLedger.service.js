"use strict";
const mongoose = require("mongoose");
const Ledger = require("../models/GrukLedgerV1");
const { GENESIS, hashMovimiento } = require("./ledgerAppend.service");

async function verificarCadena({ empresaId, sedeId, cuenta, session } = {}) {
  if (!mongoose.isValidObjectId(empresaId) ||
      !mongoose.isValidObjectId(sedeId) ||
      typeof cuenta !== "string" || !cuenta.trim()) {
    throw new Error("LEDGER_VERIFICACION_IDENTIDAD_INVALIDA");
  }
  const query = Ledger.find({ empresaId, sedeId, cuenta }).sort({ secuencia: 1 }).lean();
  if (session) query.session(session);
  const rows = await query;
  let secuencia = 0;
  let anterior = GENESIS;
  let saldo = 0n;
  for (const row of rows) {
    secuencia += 1;
    const monto = BigInt(row.montoMenor);
    const antes = BigInt(row.saldoAntesMenor);
    const despues = BigInt(row.saldoDespuesMenor);
    const esperado = saldo + (row.tipo === "CARGO" ? -monto : monto);
    if (row.secuencia !== secuencia ||
        row.hashAnterior !== anterior ||
        row.hash !== hashMovimiento(row) ||
        antes !== saldo ||
        despues !== esperado ||
        row.deletedAt !== null ||
        row.moneda !== "COP") {
      return { integra: false, secuencia, movimientoId: String(row._id) };
    }
    anterior = row.hash;
    saldo = despues;
  }
  return { integra: true, movimientos: secuencia, saldoMenor: saldo.toString(), hashFinal: anterior };
}
module.exports = { verificarCadena };
