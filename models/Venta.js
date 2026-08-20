const mongoose = require("mongoose");

const ventaSchema = new mongoose.Schema(
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

    origen: {
      type: String,
      default: "restaurante"
    },

    origenId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    },

    concepto: {
      type: String,
      required: true
    },

    categoria: {
      type: String,
      default: ""
    },

    cantidad: {
      type: Number,
      default: 1
    },

    precioUnitario: {
      type: Number,
      required: true
    },
    costoUnitario: {
  type: Number,
  default: 0,
  min: 0
},

costoTotal: {
  type: Number,
  default: 0,
  min: 0
},

utilidadBruta: {
  type: Number,
  default: 0
},

margenBruto: {
  type: Number,
  default: 0
},

    total: {
      type: Number,
      required: true
    },

    metodoPago: {
      type: String,
      default: ""
    },

    estado: {
      type: String,
      enum: ["pendiente", "pagada", "anulada"],
      default: "pagada"
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

ventaSchema.index({
  empresaId: 1,
  fecha: -1
});
ventaSchema.index(
  {
    origen: 1,
    origenId: 1
  },
  {
    unique: true,
    partialFilterExpression: {
      origenId: { $type: "objectId" }
    }
  }
);

module.exports =
  mongoose.models.Venta ||
  mongoose.model("Venta", ventaSchema);