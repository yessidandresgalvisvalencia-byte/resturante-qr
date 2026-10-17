const mongoose = require("mongoose")

const pedidoSchema = new mongoose.Schema({
    // Optional for legacy orders; mandatory for future offline-created orders.
    empresaId: { type: mongoose.Schema.Types.ObjectId, ref: "Empresa", default: null, index: true },
    offlineEventId: { type: String, default: undefined },
    restaurantId: {
        type: String,
        default: "rest1"
    },
    sedeId: {
  type: String,
  default: ""
},
menuItemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Menu",
    default: null,
    index: true
},

productoServicioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ProductoServicio",
    default: null,
    index: true
},

clienteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Cliente",
    default: null,
    index: true
},

cantidad: {
    type: Number,
    required: true,
    default: 1,
    min: 1
},

precioUnitario: {
    type: Number,
    required: true,
    min: 0
},

valorExtraUnitario: {
    type: Number,
    default: 0,
    min: 0
},

extra: {
    type: String,
    default: "",
    trim: true
},
    mesa: {
        type: Number,
        required: true
    },
    observaciones: {
  type: String,
  default: ""
},
    producto: {
        type: String,
        required: true
    },
    categoria: {
        type: String,
        default: ""
    },
    precio: {
        type: Number,
        required: true
    },
    estado: {
        type: String,
        enum: ["pendiente", "preparando", "listo", "entregado"],
        default: "pendiente"
    },
    tiempoEstimado: {
        type: Number,
        default: 15
    },
    metodoPago: {
        type: String,
        enum: ["efectivo", "transferencia", "pse", "tarjeta"],
        default: "efectivo"
    },
    estadoPago: {
        type: String,
        enum: ["pendiente", "pagado"],
        default: "pendiente"
    }
}, {
    timestamps: true
})

// Partial unique key protects against concurrent retries without changing legacy orders.
pedidoSchema.index({ empresaId: 1, sedeId: 1, offlineEventId: 1 }, {
  unique: true,
  name: "uniq_pedido_offline_event_tenant",
  partialFilterExpression: { offlineEventId: { $type: "string" } }
});

module.exports = mongoose.model("Pedido", pedidoSchema)