"use strict";

const mongoose = require("mongoose");

const medicionSchema = new mongoose.Schema({
  valor: { type: Number, default: null },
  objetivo: { type: Number, default: null },
  medible: { type: Boolean, required: true },
  measuredAt: { type: Date, required: true }
}, { _id: false });

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
  decisionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "CerebroDecision",
    required: true,
    index: true
  },
  ordenId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  departamento: {
    type: String,
    required: true
  },
  kpi: {
    type: String,
    required: true
  },
  direccion: {
    type: String,
    required: true,
    enum: ["MAYOR_ES_MEJOR", "MENOR_ES_MEJOR"]
  },
  baseline: {
    type: medicionSchema,
    required: true
  },
  seguimiento: {
    type: medicionSchema,
    default: null
  },
  evaluarAt: {
    type: Date,
    required: true,
    index: true
  },
  resultado: {
    type: String,
    required: true,
    enum: ["PENDIENTE", "MEJORO", "SIN_CAMBIO", "EMPEORO", "NO_MEDIBLE"],
    default: "PENDIENTE",
    index: true
  },
  cumplioObjetivo: {
    type: Boolean,
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
  collection: "cerebro_memoria_resultados"
});

schema.index(
  { empresaId: 1, decisionId: 1, ordenId: 1 },
  { unique: true }
);
schema.index({ empresaId: 1, createdAt: -1 });

module.exports =
  mongoose.models.CerebroMemoria ||
  mongoose.model("CerebroMemoria", schema);
