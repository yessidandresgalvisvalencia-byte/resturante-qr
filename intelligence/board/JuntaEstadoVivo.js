"use strict";

const mongoose = require("mongoose");

const eventoSchema = new mongoose.Schema({
  tipo: {
    type: String,
    required: true,
    enum: [
      "VENTA_COMPLETADA",
      "GASTO_REGISTRADO",
      "COMPRA_REGISTRADA",
      "RECALCULO"
    ]
  },
  direccion: {
    type: String,
    required: true,
    enum: [
      "ENTRADA_CONFIRMADA",
      "SALIDA_CONFIRMADA",
      "SALIDA_REGISTRADA_NO_CONFIRMADA",
      "NEUTRO"
    ]
  },
  fuenteId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  monto: {
    type: Number,
    default: null,
    min: 0
  },
  descripcion: {
    type: String,
    required: true,
    maxlength: 800
  },
  occurredAt: {
    type: Date,
    required: true
  }
}, { _id: false });

const resumenSchema = new mongoose.Schema({
  desde: {
    type: Date,
    required: true
  },
  hasta: {
    type: Date,
    required: true
  },
  ventasPagadas: {
    cantidad: { type: Number, default: 0, min: 0 },
    monto: { type: Number, default: 0, min: 0 }
  },
  comprasPagadas: {
    cantidad: { type: Number, default: 0, min: 0 },
    monto: { type: Number, default: 0, min: 0 }
  },
  gastosRegistrados: {
    cantidad: { type: Number, default: 0, min: 0 },
    monto: { type: Number, default: 0, min: 0 }
  },
  gastosPagados: {
    cantidad: { type: Number, default: 0, min: 0 },
    monto: { type: Number, default: 0, min: 0 }
  },
  gastosNoConfirmados: {
    cantidad: { type: Number, default: 0, min: 0 },
    monto: { type: Number, default: 0, min: 0 }
  },
  flujoConfirmadoParcial: {
    type: Number,
    default: 0
  }
}, { _id: false });

const diagnosticoSchema = new mongoose.Schema({
  estado: {
    type: String,
    enum: ["NORMAL", "ATENCION", "CRITICO"],
    required: true
  },
  titular: {
    type: String,
    required: true,
    maxlength: 1200
  },
  lectura: {
    type: String,
    required: true,
    maxlength: 2500
  },
  razones: {
    type: [String],
    default: []
  },
  requiereDecisionCerebro: {
    type: Boolean,
    default: false
  }
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
  ultimoEvento: {
    type: eventoSchema,
    default: null
  },
  ventana24h: {
    type: resumenSchema,
    required: true
  },
  mesActual: {
    type: resumenSchema,
    required: true
  },
  diagnostico: {
    type: diagnosticoSchema,
    required: true
  },
  reportesNeuronas: {
    type: [{
      neurona: String,
      reporteId: mongoose.Schema.Types.ObjectId,
      estado: String,
      kpi: String,
      valorActual: mongoose.Schema.Types.Mixed,
      valorObjetivo: mongoose.Schema.Types.Mixed,
      timestamp: Date
    }],
    default: []
  },
  version: {
    type: Number,
    default: 1,
    min: 1
  },
  ultimoCambioAt: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
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
  collection: "junta_estado_vivo"
});

schema.index(
  { empresaId: 1, sedeId: 1 },
  { unique: true }
);
schema.index({
  empresaId: 1,
  ultimoCambioAt: -1
});

module.exports =
  mongoose.models.JuntaEstadoVivo ||
  mongoose.model("JuntaEstadoVivo", schema);
