const mongoose = require("mongoose")

const llamadoSchema = new mongoose.Schema({
    restaurantId: {
        type: String,
        default: "rest1"
    },
    mesa: {
        type: Number,
        required: true
    },
    mensaje: {
        type: String,
        default: "Mesa necesita atención"
    },
    estado: {
        type: String,
        enum: ["pendiente", "atendido"],
        default: "pendiente"
    }
}, {
    timestamps: true
})

module.exports = mongoose.model("Llamado", llamadoSchema)