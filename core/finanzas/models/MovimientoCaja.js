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
  cuentaTesoreriaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "CuentaTesoreria",
    default: null,
    index: true
  },
  estadoAsignacionCuenta: {
    type: String,
    enum: [
      "ASIGNADA",
      "SIN_ASIGNAR",
      "TRANSFERENCIA"
    ],
    default: "SIN_ASIGNAR",
    index: true
  },
  direccion: {
    type: String,
    required: true,
    enum: ["ENTRADA", "SALIDA"],
    index: true
  },
  monto: {
    type: Number,
    required: true,
    min: 0.01
  },
  moneda: {
    type: String,
    required: true,
    default: "COP",
    enum: ["COP"]
  },
  origenTipo: {
    type: String,
    required: true,
    enum: [
      "VENTA",
      "COMPRA",
      "GASTO",
      "TRANSFERENCIA"
    ],
    index: true
  },
  origenId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  tipoAsiento: {
    type: String,
    required: true,
    enum: ["CONFIRMACION", "REVERSION"],
    index: true
  },
  movimientoOriginalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "MovimientoCaja",
    default: null,
    index: true
  },
  concepto: {
    type: String,
    default: "",
    trim: true,
    maxlength: 500
  },
  metodoPago: {
    type: String,
    default: "",
    trim: true,
    maxlength: 80
  },
  claveIdempotencia: {
    type: String,
    required: true,
    trim: true,
    maxlength: 400,
    unique: true,
    index: true
  },
  referenciaEconomica: {
    type: String,
    default: null,
    trim: true,
    maxlength: 200,
    index: true
  },
  confirmadoAt: {
    type: Date,
    required: true,
    index: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Usuario",
    default: null
  },
  deletedAt: {
    type: Date,
    default: null,
    index: true
  }
}, {
  timestamps: true,
  collection: "movimientos_caja",
  versionKey: false
});

schema.index({
  empresaId: 1,
  confirmadoAt: -1
});

schema.index({
  empresaId: 1,
  sedeId: 1,
  confirmadoAt: -1
});

schema.index({
  empresaId: 1,
  cuentaTesoreriaId: 1,
  confirmadoAt: -1
});

schema.index({
  empresaId: 1,
  origenTipo: 1,
  origenId: 1,
  confirmadoAt: -1
});

schema.index({
  empresaId: 1,
  referenciaEconomica: 1,
  confirmadoAt: -1
});

module.exports =
  mongoose.models.MovimientoCaja ||
  mongoose.model(
    "MovimientoCaja",
    schema
  );
