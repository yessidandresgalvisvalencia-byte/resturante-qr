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
    maxlength: 120
  },
  tipo: {
    type: String,
    required: true,
    enum: [
      "EFECTIVO",
      "BANCO",
      "BILLETERA",
      "OTRO"
    ],
    index: true
  },
  moneda: {
    type: String,
    enum: ["COP"],
    default: "COP"
  },
  saldoInicial: {
    type: Number,
    required: true,
    default: 0
  },
  saldoInicialAt: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  metodosPagoAsociados: {
    type: [{
      type: String,
      enum: [
        "efectivo",
        "transferencia",
        "tarjeta",
        "nequi",
        "daviplata",
        "otro"
      ]
    }],
    default: []
  },
  esPrincipal: {
    type: Boolean,
    default: false
  },
  permiteSaldoNegativo: {
    type: Boolean,
    default: false
  },
  estado: {
    type: String,
    enum: ["activa", "inactiva"],
    default: "activa",
    index: true
  },
  versionSaldo: {
    type: Number,
    default: 0,
    min: 0
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
  collection: "cuentas_tesoreria",
  versionKey: false
});

schema.index({
  empresaId: 1,
  sedeId: 1,
  estado: 1
});

schema.index(
  {
    empresaId: 1,
    sedeId: 1,
    nombre: 1
  },
  {
    unique: true,
    partialFilterExpression: {
      deletedAt: null
    }
  }
);

module.exports =
  mongoose.models.CuentaTesoreria ||
  mongoose.model(
    "CuentaTesoreria",
    schema
  );
