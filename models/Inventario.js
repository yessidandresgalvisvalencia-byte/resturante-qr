const mongoose = require("mongoose");

const inventarioSchema = new mongoose.Schema(
  {
    // =========================
    // GRUK CORE
    // =========================

    empresaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Empresa",
      default: null,
      index: true
    },

    sedeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sede",
      default: null,
      index: true
    },

    // Compatibilidad con GRUK Restaurantes
    restaurantId: {
      type: String,
      default: null,
      index: true
    },

    nombre: {
      type: String,
      required: true,
      trim: true
    },

    categoria: {
      type: String,
      required: true,
      trim: true
    },

    cantidad: {
      type: Number,
      required: true,
      min: 0
    },

    costo: {
      type: Number,
      default: 0,
      min: 0
    },

    unidad: {
      type: String,
      default: "unidades",
      trim: true
    },

    proveedor: {
      type: String,
      default: "",
      trim: true
    },

    fechaCompra: {
      type: Date,
      default: null
    },

    // No todas las industrias manejan vencimientos
    fechaVencimiento: {
      type: Date,
      default: null
    },

    estado: {
      type: String,
      enum: [
        "vigente",
        "proximo",
        "vencido",
        "agotado"
      ],
      default: "vigente"
    },

    prioridad: {
      type: String,
      enum: [
        "baja",
        "media",
        "alta"
      ],
      default: "media"
    },

    anulado: {
      type: Boolean,
      default: false
    },

    motivoAnulacion: {
      type: String,
      default: ""
    },

    fechaAnulacion: {
      type: Date,
      default: null
    },

    usuarioAnulacion: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

module.exports =
  mongoose.models.Inventario ||
  mongoose.model("Inventario", inventarioSchema);