"use strict";

const mongoose = require("mongoose");

const eventoSchema = new mongoose.Schema({
  tipo: {
    type: String,
    required: true,
    enum: [
      "VENTA_COMPLETADA",
      "GASTO_REGISTRADO",
      "GASTO_PAGO_ACTUALIZADO",
      "COMPRA_REGISTRADA",
      "COMPRA_PAGO_ACTUALIZADO",
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
  comprasNoConfirmadas: {
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
  entradasConfirmadas: {
    type: Number,
    default: 0,
    min: 0
  },
  salidasConfirmadas: {
    type: Number,
    default: 0,
    min: 0
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
  },
  cambioDesdeAnterior: {
    direccion: {
      type: String,
      enum: [
        "AUMENTA_FLUJO_PARCIAL",
        "REDUCE_FLUJO_PARCIAL",
        "SIN_CAMBIO",
        "INICIAL"
      ],
      default: "INICIAL"
    },
    valor: {
      type: Number,
      default: 0
    },
    explicacion: {
      type: String,
      default: "",
      maxlength: 800
    }
  }
}, { _id: false });

const historialSchema = new mongoose.Schema({
  version: {
    type: Number,
    required: true
  },
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
  tipoEvento: {
    type: String,
    required: true
  },
  direccionEvento: {
    type: String,
    required: true
  },
  montoEvento: {
    type: Number,
    default: null
  },
  flujoConfirmadoParcial: {
    type: Number,
    required: true
  },
  createdAt: {
    type: Date,
    required: true
  }
}, { _id: false });

const diagnosticoExpertoSchema = new mongoose.Schema({
  departamento: {
    type: String,
    required: true,
    enum: [
      "DIRECCION",
      "OPERACIONES",
      "VENTAS",
      "FINANZAS",
      "MARKETING",
      "GENTE",
      "SERVICIO_CLIENTE"
    ]
  },
  relevancia: {
    type: String,
    required: true,
    enum: [
      "ALTA",
      "MEDIA",
      "BAJA",
      "NINGUNA"
    ]
  },
  respuesta: {
    type: String,
    required: true,
    maxlength: 3000
  },
  criterioProfesional: {
    type: String,
    default: "",
    maxlength: 1800
  },
  evidencia: {
    type: [String],
    default: []
  },
  riesgos: {
    type: [String],
    default: []
  },
  datosFaltantes: {
    type: [String],
    default: []
  },
  confianza: {
    type: Number,
    min: 0,
    max: 100,
    default: null
  },
  generatedAt: {
    type: Date,
    required: true
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
  diagnosticosExpertos: {
    type: [diagnosticoExpertoSchema],
    default: []
  },
  historialDiagnosticos: {
    type: [historialSchema],
    default: []
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
