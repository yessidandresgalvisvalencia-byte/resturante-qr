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
  reservaCajaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ReservaCaja",
    required: true,
    index: true
  },
  cuentaTesoreriaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "CuentaTesoreria",
    required: true,
    index: true
  },
  monto: {
    type: Number,
    required: true,
    min: 0.01
  },
  fecha: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  concepto: {
    type: String,
    required: true,
    trim: true,
    maxlength: 300
  },
  movimientoCajaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "MovimientoCaja",
    required: true,
    unique: true,
    index: true
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
  collection: "retiros_dueno",
  versionKey: false
});

schema.index({
  empresaId: 1,
  fecha: -1
});

module.exports =
  mongoose.models.RetiroDueno ||
  mongoose.model(
    "RetiroDueno",
    schema
  );
