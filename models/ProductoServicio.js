const mongoose = require("mongoose");

const productoServicioSchema = new mongoose.Schema(
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

    tipo: {
      type: String,
      enum: ["producto", "servicio"],
      required: true,
      index: true
    },

    nombre: {
      type: String,
      required: true,
      trim: true
    },

    descripcion: {
      type: String,
      default: "",
      trim: true
    },

    categoria: {
      type: String,
      default: "",
      trim: true
    },

    sku: {
      type: String,
      default: "",
      trim: true
    },

    precioVenta: {
      type: Number,
      required: true,
      min: 0
    },

    costoUnitario: {
      type: Number,
      default: 0,
      min: 0
    },

    manejaInventario: {
      type: Boolean,
      default: false
    },

    unidad: {
      type: String,
      default: "unidad",
      trim: true
    },

    activo: {
      type: Boolean,
      default: true
    },

    origen: {
      type: String,
      default: "core",
      trim: true
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

productoServicioSchema.index({
  empresaId: 1,
  tipo: 1,
  activo: 1
});

productoServicioSchema.index({
  empresaId: 1,
  sku: 1
});

module.exports =
  mongoose.models.ProductoServicio ||
  mongoose.model(
    "ProductoServicio",
    productoServicioSchema
  );