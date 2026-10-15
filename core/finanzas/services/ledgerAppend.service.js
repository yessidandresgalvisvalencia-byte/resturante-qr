"use strict";

const { createHash } = require("node:crypto");
const mongoose = require("mongoose");
const Ledger = require("../models/GrukLedgerV1");

const GENESIS = "0".repeat(64);
const INT = /^-?(0|[1-9][0-9]*)$/;
const POS = /^(0|[1-9][0-9]*)$/;

function hashMovimiento(data) {
  const canonical = [
    "GRUK_LEDGER_V1", data.empresaId, data.sedeId, data.cuenta,
    data.secuencia, data.tipo, data.moneda, data.montoMenor,
    data.saldoAntesMenor, data.saldoDespuesMenor, data.actorId,
    data.ip, data.claveIdempotencia, data.hashAnterior,
    data.correccionDe || ""
  ].map(String).join("\n");
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

function validarEntrada(data) {
  if (!data || !mongoose.isValidObjectId(data.empresaId) ||
      !mongoose.isValidObjectId(data.sedeId) ||
      !mongoose.isValidObjectId(data.actorId)) throw new Error("LEDGER_IDENTIDAD_INVALIDA");
  if (typeof data.cuenta !== "string" || !data.cuenta.trim() || data.cuenta.length > 120 ||
      typeof data.ip !== "string" || !data.ip.trim() || data.ip.length > 128 ||
      typeof data.claveIdempotencia !== "string" ||
      data.claveIdempotencia.length < 8 || data.claveIdempotencia.length > 200 ||
      !["CARGO", "ABONO"].includes(data.tipo) ||
      typeof data.montoMenor !== "string" || !POS.test(data.montoMenor) ||
      data.montoMenor === "0" ||
      (data.correccionDe != null && !mongoose.isValidObjectId(data.correccionDe))) {
    throw new Error("LEDGER_ENTRADA_INVALIDA");
  }
}

async function registrarMovimiento(data, { session } = {}) {
  validarEntrada(data);
  if (!session || typeof session.inTransaction !== "function" || !session.inTransaction()) {
    throw new Error("LEDGER_TRANSACCION_REQUERIDA");
  }
  const scope = { empresaId: data.empresaId, sedeId: data.sedeId };
  const existente = await Ledger.findOne({
    ...scope, claveIdempotencia: data.claveIdempotencia
  }).session(session).lean();
  if (existente) {
    if (String(existente.cuenta) !== data.cuenta ||
        existente.tipo !== data.tipo || existente.montoMenor !== data.montoMenor ||
        String(existente.actorId) !== String(data.actorId) ||
        existente.ip !== data.ip ||
        String(existente.correccionDe || "") !== String(data.correccionDe || "")) {
      throw new Error("LEDGER_IDEMPOTENCIA_CONFLICTO");
    }
    return { creado: false, movimiento: existente };
  }
  // Verify the last stored entry before extending the chain. This is not a full audit.
  const ultimo = await Ledger.findOne({ ...scope, cuenta: data.cuenta })
    .sort({ secuencia: -1 }).session(session).lean();
  if (ultimo && (ultimo.hash !== hashMovimiento(ultimo) ||
      (ultimo.secuencia === 1 && ultimo.hashAnterior !== GENESIS))) {
    throw new Error("LEDGER_ULTIMO_MOVIMIENTO_CORRUPTO");
  }
  const saldoAntes = ultimo ? ultimo.saldoDespuesMenor : "0";
  if (!INT.test(saldoAntes)) throw new Error("LEDGER_SALDO_INVALIDO");
  const delta = BigInt(data.montoMenor) * (data.tipo === "CARGO" ? -1n : 1n);
  const saldoDespues = (BigInt(saldoAntes) + delta).toString();
  const registro = {
    ...scope, cuenta: data.cuenta, secuencia: ultimo ? ultimo.secuencia + 1 : 1,
    tipo: data.tipo, moneda: "COP", montoMenor: data.montoMenor,
    saldoAntesMenor: saldoAntes, saldoDespuesMenor: saldoDespues,
    actorId: data.actorId, ip: data.ip, claveIdempotencia: data.claveIdempotencia,
    correccionDe: data.correccionDe || null,
    hashAnterior: ultimo ? ultimo.hash : GENESIS, deletedAt: null
  };
  registro.hash = hashMovimiento(registro);
  const [movimiento] = await Ledger.create([registro], { session });
  return { creado: true, movimiento };
}

module.exports = { GENESIS, hashMovimiento, registrarMovimiento };
