"use strict";

const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema({
  origenTipo: {
    type: String,
    enum: ["COMPRA", "GASTO", "RECURRENTE"],
    required: true
  },
  origenId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  descripcion: {
    type: String,
    default: ""
  },
  monto: {
    type: Number,
    required: true,
    min: 0.01
  },
  fechaVencimiento: {
    type: Date,
    default: null
  },
  estado: {
    type: String,
    enum: ["PENDIENTE_CONFIRMACION", "CONFIRMADO", "CANCELADO"],
    default: "PENDIENTE_CONFIRMACION"
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
  ordenId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  saldoDisponibleSnapshot: {
    type: Number,
    required: true
  },
  totalAutorizado: {
    type: Number,
    required: true,
    min: 0
  },
  items: {
    type: [itemSchema],
    default: []
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
  collection: "planes_ejecucion_pago",
  versionKey: false
});

schema.index({
  empresaId: 1,
  decisionId: 1,
  ordenId: 1
}, { unique: true });

module.exports =
  mongoose.models.PlanEjecucionPago ||
  mongoose.model("PlanEjecucionPago", schema);
