"use strict";

const mongoose = require("mongoose");

const intervencionSchema = new mongoose.Schema({
  tipo: {
    type: String,
    required: true,
    enum: ["NEURONA", "HUMANO"]
  },
  departamento: {
    type: String,
    required: true,
    enum: ["DIRECCION", "OPERACIONES", "VENTAS", "FINANZAS", "MARKETING", "GENTE", "SERVICIO_CLIENTE"]
  },
  autorUsuarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Usuario",
    default: null
  },
  mensaje: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  evidencia: {
    type: String,
    default: "",
    trim: true,
    maxlength: 4000
  },
  impacto_financiero_estimado: {
    type: Number,
    default: null
  },
  confianza: {
    type: Number,
    min: 0,
    max: 100,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

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
  estado: {
    type: String,
    required: true,
    enum: ["ABIERTA", "CERRADA"],
    default: "ABIERTA",
    index: true
  },
  intervenciones: {
    type: [intervencionSchema],
    default: []
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Usuario",
    required: true
  },
  closedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Usuario",
    default: null
  },
  closedAt: {
    type: Date,
    default: null
  },
  deletedAt: {
    type: Date,
    default: null,
    index: true
  }
}, {
  timestamps: true,
  collection: "junta_sesiones"
});

schema.index({ empresaId: 1, decisionId: 1 }, { unique: true });
schema.index({ empresaId: 1, createdAt: -1 });

module.exports =
  mongoose.models.JuntaSesion ||
  mongoose.model("JuntaSesion", schema);
