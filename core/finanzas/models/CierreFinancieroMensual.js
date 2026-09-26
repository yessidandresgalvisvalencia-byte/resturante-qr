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
  periodo: {
    type: String,
    required: true,
    match: /^\d{4}-\d{2}$/,
    index: true
  },
  desde: {
    type: Date,
    required: true
  },
  hasta: {
    type: Date,
    required: true
  },
  ventasTotales: {
    type: Number,
    required: true,
    min: 0
  },
  ingresosTotales: {
    type: Number,
    required: true,
    min: 0
  },
  costosConfiables: {
    type: Number,
    required: true,
    min: 0
  },
  coberturaCostoPorcentaje: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  utilidadBrutaConfiable: {
    type: Number,
    default: null
  },
  gastosRegistrados: {
    type: Number,
    required: true,
    min: 0
  },
  utilidadOperacionalConfiable: {
    type: Number,
    default: null
  },
  estadoConfiabilidad: {
    type: String,
    enum: [
      "COMPLETO",
      "PARCIAL"
    ],
    required: true,
    index: true
  },
  cerradoAt: {
    type: Date,
    required: true,
    default: Date.now
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
  collection: "cierres_financieros_mensuales",
  versionKey: false
});

schema.index(
  {
    empresaId: 1,
    periodo: 1,
    sedeId: 1
  },
  {
    unique: true,
    partialFilterExpression: {
      deletedAt: null
    }
  }
);

module.exports =
  mongoose.models.CierreFinancieroMensual ||
  mongoose.model(
    "CierreFinancieroMensual",
    schema
  );
