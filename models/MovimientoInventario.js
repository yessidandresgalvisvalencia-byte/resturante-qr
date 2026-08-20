const mongoose = require("mongoose");

const movimientoInventarioSchema = new mongoose.Schema(
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
      default: null,
      index: true
    },

    productoServicioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductoServicio",
      default: null,
      index: true
    },

    inventarioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Inventario",
      default: null
    },

    tipo: {
      type: String,
      enum: [
        "entrada",
        "salida",
        "ajuste",
        "traslado"
      ],
      required: true
    },

    motivo: {
      type: String,
      enum: [
        "compra",
        "venta",
        "devolucion",
        "desperdicio",
        "ajuste",
        "traslado",
        "produccion",
        "otro"
      ],
      required: true
    },

    cantidad: {
      type: Number,
      required: true,
      min: 0
    },

    stockAnterior: {
      type: Number,
      required: true,
      min: 0
    },

    stockNuevo: {
      type: Number,
      required: true,
      min: 0
    },

    costoUnitario: {
      type: Number,
      default: 0,
      min: 0
    },

    referenciaTipo: {
      type: String,
      default: ""
    },

    referenciaId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true
    },

    observaciones: {
      type: String,
      default: ""
    },

    fecha: {
      type: Date,
      default: Date.now,
      index: true
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

movimientoInventarioSchema.index({
  empresaId: 1,
  productoServicioId: 1,
  fecha: -1
});

movimientoInventarioSchema.index({
  empresaId: 1,
  motivo: 1,
  fecha: -1
});

module.exports =
  mongoose.models.MovimientoInventario ||
  mongoose.model(
    "MovimientoInventario",
    movimientoInventarioSchema
  );