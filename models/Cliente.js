"use strict";

const mongoose = require("mongoose");

const identidadClienteSchema = new mongoose.Schema(
  {
    tipo: {
      type: String,
      enum: ["DOCUMENTO", "CORREO", "TELEFONO"],
      required: true
    },

    hash: {
      type: String,
      required: true,
      trim: true
    }
  },
  {
    _id: false
  }
);

const clienteSchema = new mongoose.Schema(
  {
    empresaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Empresa",
      required: true,
      index: true
    },

    sedeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sede",
      required: true,
      index: true
    },

    identidades: {
      type: [identidadClienteSchema],
      default: []
    },

    primeraCompraAt: {
      type: Date,
      default: null
    },

    ultimaCompraAt: {
      type: Date,
      default: null
    },

    numeroCompras: {
      type: Number,
      default: 0,
      min: 0
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Usuario",
      default: null
    },

    actorType: {
      type: String,
      enum: ["USUARIO", "SISTEMA"],
      required: true
    },

    deletedAt: {
      type: Date,
      default: null,
      index: true
    }
  },
  {
    timestamps: true
  }
);

clienteSchema.index({
  empresaId: 1,
  "identidades.tipo": 1,
  "identidades.hash": 1
});

clienteSchema.index({
  empresaId: 1,
  ultimaCompraAt: -1
});

module.exports =
  mongoose.models.Cliente ||
  mongoose.model("Cliente", clienteSchema);
