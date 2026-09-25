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
  nombre: {
    type: String,
    required: true,
    trim: true,
    maxlength: 160
  },
  categoria: {
    type: String,
    required: true,
    enum: [
      "NOMINA",
      "ARRIENDO",
      "SERVICIOS",
      "IMPUESTOS",
      "DEUDA",
      "SEGUROS",
      "LICENCIAS",
      "OTRO"
    ],
    index: true
  },
  monto: {
    type: Number,
    required: true,
    min: 0.01
  },
  frecuencia: {
    type: String,
    required: true,
    enum: [
      "SEMANAL",
      "QUINCENAL",
      "MENSUAL",
      "BIMESTRAL",
      "TRIMESTRAL",
      "SEMESTRAL",
      "ANUAL"
    ]
  },
  proximoVencimiento: {
    type: Date,
    required: true,
    index: true
  },
  fechaFin: {
    type: Date,
    default: null,
    index: true
  },
  tercero: {
    type: String,
    default: "",
    trim: true,
    maxlength: 160
  },
  notas: {
    type: String,
    default: "",
    trim: true,
    maxlength: 1000
  },
  fuenteMonto: {
    type: String,
    required: true,
    enum: [
      "CONTRATO",
      "HISTORICO",
      "ESTIMADO_MANUAL",
      "OTRO"
    ]
  },
  estado: {
    type: String,
    enum: ["activa", "inactiva"],
    default: "activa",
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
  collection: "obligaciones_recurrentes",
  versionKey: false
});

schema.index({
  empresaId: 1,
  sedeId: 1,
  estado: 1,
  proximoVencimiento: 1
});

module.exports =
  mongoose.models.ObligacionRecurrente ||
  mongoose.model(
    "ObligacionRecurrente",
    schema
  );
