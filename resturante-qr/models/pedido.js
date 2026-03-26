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
    mesa: {
        type: Number,
        required: true
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
        enum: ["pedido", "preparando", "listo", "entregado"],
        default: "pedido"
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