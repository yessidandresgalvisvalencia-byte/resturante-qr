"use strict";

const mongoose = require("mongoose");

const clienteIdentidadSchema = new mongoose.Schema(
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

    clienteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cliente",
      required: true,
      index: true
    },

    tipo: {
      type: String,
      enum: ["DOCUMENTO", "CORREO", "TELEFONO"],
      required: true
    },

    hash: {
      type: String,
      required: true,
      trim: true
    },

    hashVersion: {
      type: String,
      required: true,
      default: "v1",
      trim: true
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

clienteIdentidadSchema.index(
  {
    empresaId: 1,
    tipo: 1,
    hashVersion: 1,
    hash: 1
  },
  {
    name: "uq_cliente_identidad_activa",
    unique: true,
    partialFilterExpression: {
      deletedAt: null
    }
  }
);

clienteIdentidadSchema.index({
  empresaId: 1,
  clienteId: 1,
  deletedAt: 1
});

module.exports =
  mongoose.models.ClienteIdentidad ||
  mongoose.model(
    "ClienteIdentidad",
    clienteIdentidadSchema
  );
