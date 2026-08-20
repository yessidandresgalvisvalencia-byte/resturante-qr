const mongoose = require("mongoose");

const itemCompraSchema = new mongoose.Schema(
  {
    productoServicioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductoServicio",
      default: null
    },

    nombre: {
      type: String,
      required: true,
      trim: true
    },

    cantidad: {
      type: Number,
      required: true,
      min: 0
    },

    costoUnitario: {
      type: Number,
      required: true,
      min: 0
    },

    subtotal: {
      type: Number,
      required: true,
      min: 0
    },

    unidad: {
      type: String,
      default: "unidad",
      trim: true
    }
  },
  {
    _id: true
  }
);

const compraSchema = new mongoose.Schema(
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

    proveedor: {
      type: String,
      default: "",
      trim: true
    },

    numeroDocumento: {
      type: String,
      default: "",
      trim: true
    },

    items: {
      type: [itemCompraSchema],
      default: []
    },

    subtotal: {
      type: Number,
      required: true,
      min: 0
    },

    impuestos: {
      type: Number,
      default: 0,
      min: 0
    },

    total: {
      type: Number,
      required: true,
      min: 0
    },

    metodoPago: {
      type: String,
      enum: [
        "efectivo",
        "transferencia",
        "tarjeta",
        "credito",
        "otro"
      ],
      default: "efectivo"
    },

    estadoPago: {
      type: String,
      enum: [
        "pendiente",
        "parcial",
        "pagado"
      ],
      default: "pagado"
    },

    estado: {
      type: String,
      enum: [
        "registrada",
        "anulada"
      ],
      default: "registrada"
    },

    fecha: {
      type: Date,
      default: Date.now,
      index: true
    },

    observaciones: {
      type: String,
      default: ""
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

compraSchema.index({
  empresaId: 1,
  fecha: -1
});

module.exports =
  mongoose.models.Compra ||
  mongoose.model("Compra", compraSchema);