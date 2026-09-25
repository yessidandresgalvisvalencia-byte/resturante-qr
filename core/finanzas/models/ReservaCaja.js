"use strict";

const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  empresaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Empresa",
    required: true,
    index: true
  },
  sedeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Sede",
    default: null,
    index: true
  },
  categoria: {
    type: String,
    enum: [
      "COLCHON_OPERATIVO",
      "NOMINA",
      "IMPUESTOS",
      "DEUDA",
      "ARRIENDO",
      "UTILIDAD_DUENO",
      "OTRO"
    ],
    required: true,
    index: true
  },
  monto: {
    type: Number,
    required: true,
    min: 0.01
  },
  estado: {
    type: String,
    enum: [
      "PROPUESTA",
      "ACTIVA",
      "LIBERADA",
      "CONSUMIDA"
    ],
    default: "PROPUESTA",
    index: true
  },
  origenTipo: {
    type: String,
    enum: [
      "CIERRE_MENSUAL",
      "MANUAL"
    ],
    required: true
  },
  origenId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
    index: true
  },
  concepto: {
    type: String,
    required: true,
    trim: true,
    maxlength: 300
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Usuario",
    default: null
  },
  approvedAt: {
    type: Date,
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Usuario",
    required: true
  },
  deletedAt: {
    type: Date,
    default: null,
    index: true
  }
}, {
  timestamps: true,
  collection: "reservas_caja",
  versionKey: false
});

schema.index({
  empresaId: 1,
  estado: 1,
  categoria: 1,
  createdAt: -1
});

module.exports =
  mongoose.models.ReservaCaja ||
  mongoose.model(
    "ReservaCaja",
    schema
  );
