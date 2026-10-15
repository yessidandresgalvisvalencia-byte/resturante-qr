"use strict";

const mongoose = require("mongoose");

const entregaSchema = new mongoose.Schema({
  empresaId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  eventId: { type: mongoose.Schema.Types.ObjectId, required: true },
  consumidor: { type: String, required: true, trim: true },
  estado: { type: String, required: true, enum: ["PENDIENTE", "PROCESANDO", "ENTREGADO"], default: "PENDIENTE" },
  intentos: { type: Number, default: 0, min: 0 },
  leaseToken: { type: String, default: null },
  leaseHasta: { type: Date, default: null },
  ultimoError: { type: String, default: "" },
  entregadoAt: { type: Date, default: null }
}, { timestamps: true });

entregaSchema.index({ eventId: 1, consumidor: 1 }, { unique: true });
entregaSchema.index({ empresaId: 1, eventId: 1, consumidor: 1 });
entregaSchema.index({ consumidor: 1, estado: 1, leaseHasta: 1 });
// Tenant-scoped keyset recovery: equality filters first, then stable _id scan.
entregaSchema.index({ empresaId: 1, consumidor: 1, _id: 1 });

module.exports = mongoose.models.GrukEntregaConsumidor ||
  mongoose.model("GrukEntregaConsumidor", entregaSchema);
