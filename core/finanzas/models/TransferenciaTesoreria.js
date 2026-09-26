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
  cuentaOrigenId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "CuentaTesoreria",
    required: true,
    index: true
  },
  cuentaDestinoId: {
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
  concepto: {
    type: String,
    default: "Transferencia interna",
    trim: true,
    maxlength: 500
  },
  fecha: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  estado: {
    type: String,
    enum: ["completada"],
    default: "completada"
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
  collection: "transferencias_tesoreria",
  versionKey: false
});

schema.index({
  empresaId: 1,
  fecha: -1
});

module.exports =
  mongoose.models.TransferenciaTesoreria ||
  mongoose.model(
    "TransferenciaTesoreria",
    schema
  );
