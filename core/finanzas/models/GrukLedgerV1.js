"use strict";

const mongoose = require("mongoose");

const ledgerSchema = new mongoose.Schema({
  empresaId: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true },
  sedeId: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true },
  cuenta: { type: String, required: true, immutable: true, maxlength: 120 },
  secuencia: { type: Number, required: true, immutable: true, min: 1 },
  tipo: { type: String, required: true, immutable: true, enum: ["CARGO", "ABONO", "CORRECCION"] },
  moneda: { type: String, required: true, immutable: true, enum: ["COP"] },
  montoMenor: { type: String, required: true, immutable: true, match: /^(0|[1-9][0-9]*)$/ },
  saldoAntesMenor: { type: String, required: true, immutable: true, match: /^-?(0|[1-9][0-9]*)$/ },
  saldoDespuesMenor: { type: String, required: true, immutable: true, match: /^-?(0|[1-9][0-9]*)$/ },
  actorId: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true },
  ip: { type: String, required: true, immutable: true, maxlength: 128 },
  hashAnterior: { type: String, required: true, immutable: true, match: /^[a-f0-9]{64}$/ },
  hash: { type: String, required: true, immutable: true, match: /^[a-f0-9]{64}$/ },
  claveIdempotencia: { type: String, required: true, immutable: true, maxlength: 200 },
  correccionDe: { type: mongoose.Schema.Types.ObjectId, default: null, immutable: true },
  deletedAt: { type: Date, default: null, immutable: true }
}, {
  strict: "throw",
  timestamps: { createdAt: true, updatedAt: false },
  versionKey: false,
  collection: "gruk_ledger_v1"
});

ledgerSchema.index({ empresaId: 1, sedeId: 1, cuenta: 1, secuencia: 1 }, { unique: true });
ledgerSchema.index({ empresaId: 1, sedeId: 1, claveIdempotencia: 1 }, { unique: true });
ledgerSchema.index({ empresaId: 1, sedeId: 1, createdAt: -1 });

function immutableError() {
  throw new Error("GRUK_LEDGER_APPEND_ONLY");
}
for (const operation of ["updateOne", "updateMany", "findOneAndUpdate", "replaceOne",
  "findOneAndReplace", "deleteOne", "deleteMany", "findOneAndDelete"]) {
  ledgerSchema.pre(operation, immutableError);
}
ledgerSchema.pre("save", function enforceInsertOnly() {
  if (!this.isNew) immutableError();
});

module.exports = mongoose.models.GrukLedgerV1 ||
  mongoose.model("GrukLedgerV1", ledgerSchema);
