const mongoose = require("mongoose");

const gastoSchema = new mongoose.Schema(
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

    concepto: {
      type: String,
      required: true,
      trim: true
    },

    categoria: {
      type: String,
      required: true,
      trim: true
    },

    monto: {
      type: Number,
      required: true,
      min: 0
    },

    metodoPago: {
      type: String,
      default: "",
      trim: true
    },

    proveedor: {
      type: String,
      default: "",
      trim: true
    },

    estado: {
      type: String,
      enum: ["registrado", "anulado"],
      default: "registrado"
    },

    fecha: {
      type: Date,
      default: Date.now,
      index: true
    },

    origen: {
      type: String,
      default: "manual"
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

gastoSchema.index({ empresaId: 1, fecha: -1 });
gastoSchema.index({ empresaId: 1, sedeId: 1, fecha: -1 });

module.exports =
  mongoose.models.Gasto ||
  mongoose.model("Gasto", gastoSchema);