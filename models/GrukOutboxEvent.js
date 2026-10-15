"use strict";

const mongoose = require("mongoose");

const outboxSchema = new mongoose.Schema({
  empresaId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  eventName: { type: String, required: true, enum: ["VENTA_COMPLETADA"] },
  aggregateId: { type: mongoose.Schema.Types.ObjectId, required: true },
  payload: { type: mongoose.Schema.Types.Mixed, required: true },
  estado: { type: String, enum: ["PENDIENTE", "ENTREGADO"], default: "PENDIENTE", index: true },
  intentos: { type: Number, default: 0, min: 0 },
  ultimoError: { type: String, default: "" },
  entregadoAt: { type: Date, default: null }
}, { timestamps: true });

outboxSchema.index({ eventName: 1, aggregateId: 1 }, { unique: true });
outboxSchema.index({ estado: 1, createdAt: 1 });

module.exports = mongoose.models.GrukOutboxEvent ||
  mongoose.model("GrukOutboxEvent", outboxSchema);
