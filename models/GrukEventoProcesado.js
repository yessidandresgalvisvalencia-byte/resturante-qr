"use strict";

const mongoose = require("mongoose");

const procesadoSchema = new mongoose.Schema({
  empresaId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  consumidor: { type: String, required: true, trim: true },
  eventId: { type: mongoose.Schema.Types.ObjectId, required: true },
  procesadoAt: { type: Date, default: Date.now }
}, { timestamps: false });

procesadoSchema.index({ consumidor: 1, eventId: 1 }, { unique: true });

module.exports = mongoose.models.GrukEventoProcesado ||
  mongoose.model("GrukEventoProcesado", procesadoSchema);
