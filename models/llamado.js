const mongoose = require("mongoose");

const llamadoSchema = new mongoose.Schema({
  restaurantId: { type: String, required: true },
  mesa: { type: Number, required: true },
  mensaje: { type: String, default: "Mesa necesita atención" },
  estado: { type: String, default: "pendiente" },
  meseroId: { type: String, default: "" },
  meseroNombre: { type: String, default: "" }
}, { timestamps: true });

module.exports = mongoose.model("Llamado", llamadoSchema);
