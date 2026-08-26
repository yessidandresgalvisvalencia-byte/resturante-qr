const mongoose = require("mongoose")

const pedidoSchema = new mongoose.Schema({
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

module.exports = mongoose.model("Pedido", pedidoSchema)