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
  origenTipo: {
    type: String,
    enum: ["COMPRA", "GASTO", "RECURRENTE"],
    required: true,
    index: true
  },
  origenId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  motivo: {
    type: String,
    required: true,
    trim: true,
    minlength: 10,
    maxlength: 1000
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Usuario",
    required: true
  },
  revokedAt: {
    type: Date,
    default: null,
    index: true
  },
  revokedBy: {
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
  collection: "excepciones_prioridad_pago",
  versionKey: false
});

schema.index({
  empresaId: 1,
  origenTipo: 1,
  origenId: 1,
  revokedAt: 1,
  expiresAt: 1
});

module.exports =
  mongoose.models.ExcepcionPrioridadPago ||
  mongoose.model(
    "ExcepcionPrioridadPago",
    schema
  );
